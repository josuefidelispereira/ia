// functions/api/[[catchall]].js
import { createClerkClient } from '@clerk/backend';
import { Router } from 'itty-router';

// Helper para criar uma resposta JSON padronizada
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
});

const router = Router();

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
// Todas as rotas abaixo desta linha verificarão se o usuário está logado.
router.all('*', async (request, context) => {
    const clerkClient = createClerkClient({ secretKey: context.env.CLERK_SECRET_KEY });
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autorizado: Sem cabeçalho de autorização.' }, 401);

    const token = authHeader.replace('Bearer ', '');
    try {
        const claims = await clerkClient.verifyToken(token);
        if (!claims.sub) return jsonResponse({ error: 'Token inválido' }, 401);
        // Anexa o ID do usuário ao objeto 'request' para que outras rotas possam usá-lo
        request.clerkUserId = claims.sub;
    } catch (err) {
        return jsonResponse({ error: 'Não autorizado: Token expirado ou inválido.' }, 401);
    }
});

// --- ROTAS DA API ---

// GET /api/chats -> Busca o histórico de chats do usuário
router.get('/api/chats', async (request, context) => {
    const { clerkUserId } = request;
    const { DB } = context.env;
    try {
        const { results } = await DB.prepare("SELECT * FROM Chats WHERE clerkUserId = ? ORDER BY isPinned DESC, createdAt DESC")
                                  .bind(clerkUserId).all();
        return jsonResponse(results);
    } catch (e) {
        return jsonResponse({ error: 'Falha ao buscar chats', details: e.message }, 500);
    }
});

// GET /api/chats/:id/messages -> Busca as mensagens de um chat específico
router.get('/api/chats/:id/messages', async (request, context) => {
    const { clerkUserId } = request;
    const chatId = request.params.id;
    const { DB } = context.env;
    try {
        const { results } = await DB.prepare("SELECT * FROM Messages WHERE chatId = (SELECT id FROM Chats WHERE id = ? AND clerkUserId = ?) ORDER BY createdAt ASC")
                                  .bind(chatId, clerkUserId).all();
        return jsonResponse(results);
    } catch (e) {
        return jsonResponse({ error: 'Falha ao buscar mensagens', details: e.message }, 500);
    }
});


// POST /api/stream -> Rota principal de CHAT
router.post('/api/stream', async (request, context) => {
    const { clerkUserId } = request;
    const { DB, DEEPSEEK_API_KEY } = context.env;
    const requestData = await request.json();
    const { messages, chatData } = requestData;

    let chatId = chatData.id;

    // Se for uma nova conversa, cria o registro no banco primeiro
    if (!chatId) {
        chatId = `chat_${Date.now()}`;
        await DB.prepare("INSERT INTO Chats (id, clerkUserId, title, createdAt) VALUES (?, ?, ?, ?)")
              .bind(chatId, clerkUserId, chatData.title, new Date().toISOString())
              .run();
    }

    // Salva a mensagem do usuário no banco
    const userMessage = messages[messages.length - 1];
    const userMessageId = `msg_${Date.now()}`;
    await DB.prepare("INSERT INTO Messages (id, chatId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)")
          .bind(userMessageId, chatId, userMessage.role, userMessage.content, new Date().toISOString())
          .run();

    // Lógica de chamada à API DeepSeek
    const apiURL = "https://api.deepseek.com/chat/completions";
    const payload = { model: chatData.model, messages, temperature: chatData.temperature, stream: true };

    const apiResponse = await fetch(apiURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify(payload)
    });

    // Clona o stream para poder ler e enviar ao mesmo tempo.
    const [streamToClient, streamToDB] = apiResponse.body.tee();

    const saveFullResponse = async () => {
        const reader = streamToDB.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr.trim() !== '[DONE]') {
                         try {
                            const parsedData = JSON.parse(dataStr);
                            if (parsedData.choices && parsedData.choices[0].delta.content) {
                                fullResponse += parsedData.choices[0].delta.content;
                            }
                        } catch (e) {}
                    }
                }
            }
        }
        // Salva a resposta completa da IA no banco
        const aiMessageId = `msg_${Date.now()}_ai`;
        await DB.prepare("INSERT INTO Messages (id, chatId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)")
              .bind(aiMessageId, chatId, 'assistant', fullResponse, new Date().toISOString())
              .run();
    };

    context.waitUntil(saveFullResponse());

    // Retorna o ID do chat junto com o stream
    const responseWithChatId = new ReadableStream({
        start(controller) {
            controller.enqueue(`event: chat_id\ndata: ${JSON.stringify({ chatId })}\n\n`);
            const reader = streamToClient.getReader();
            function push() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(value);
                    push();
                });
            }
            push();
        }
    });

    return new Response(responseWithChatId, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });
});

// Rota para deletar um chat
router.delete('/api/chats/:id', async (request, context) => {
    const { clerkUserId } = request;
    const chatId = request.params.id;
    const { DB } = context.env;

    await DB.prepare("DELETE FROM Chats WHERE id = ? AND clerkUserId = ?").bind(chatId, clerkUserId).run();
    return jsonResponse({ success: true });
});

// Rota de fallback para 404
router.all('*', () => jsonResponse({ error: 'Rota não encontrada' }, 404));

// Handler principal que executa o roteador
export const onRequest = (context) => {
    // A rota de pegar a chave do Clerk não precisa de autenticação
    const url = new URL(context.request.url);
    if (url.pathname === '/api/clerk-key') {
        return jsonResponse({ key: context.env.PUBLIC_CLERK_PUBLISHABLE_KEY });
    }
    // Todas as outras rotas passam pelo roteador com autenticação
    return router.handle(context.request, context);
};