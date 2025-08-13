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
// Verifica se o usuário está logado em todas as rotas
const withAuth = async (request, context) => {
    const clerkClient = createClerkClient({ secretKey: context.env.CLERK_SECRET_KEY });
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autorizado.' }, 401);

    const token = authHeader.replace('Bearer ', '');
    try {
        const claims = await clerkClient.verifyToken(token);
        if (!claims.sub) return jsonResponse({ error: 'Token inválido.' }, 401);
        request.clerkUserId = claims.sub; // Anexa o ID do usuário ao request
    } catch (err) {
        return jsonResponse({ error: `Não autorizado: ${err.message}` }, 401);
    }
};

// --- ROTAS DA API ---

// GET /api/chats -> Busca o histórico de chats do usuário
router.get('/api/chats', withAuth, async (request, context) => {
    const { clerkUserId } = request;
    const { DB } = context.env;
    const { results } = await DB.prepare("SELECT * FROM Chats WHERE clerkUserId = ? ORDER BY isPinned DESC, createdAt DESC")
                              .bind(clerkUserId).all();
    return jsonResponse(results);
});
    
// GET /api/chats/:id/messages -> Busca as mensagens de um chat específico
router.get('/api/chats/:id/messages', withAuth, async (request, context) => {
    const { clerkUserId } = request;
    const chatId = request.params.id;
    const { DB } = context.env;
    
    const chatCheck = await DB.prepare("SELECT id FROM Chats WHERE id = ? AND clerkUserId = ?").bind(chatId, clerkUserId).first();
    if (!chatCheck) return jsonResponse({ error: 'Chat não encontrado' }, 404);

    const { results } = await DB.prepare("SELECT * FROM Messages WHERE chatId = ? ORDER BY createdAt ASC")
                              .bind(chatId).all();
    return jsonResponse(results);
});

// POST /api/stream -> Rota principal de CHAT, agora salva no banco
router.post('/api/stream', withAuth, async (request, context) => {
    const { clerkUserId } = request;
    const { DB, DEEPSEEK_API_KEY } = context.env;
    const { messages, chatData } = await request.json();

    let chatId = chatData.id;

    if (!chatId) {
        chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await DB.prepare("INSERT INTO Chats (id, clerkUserId, title, createdAt, systemPrompt, temperature, model) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .bind(chatId, clerkUserId, chatData.title, new Date().toISOString(), chatData.systemPrompt, chatData.temperature, chatData.model)
              .run();
    }
    
    const userMessage = messages[messages.length - 1];
    const userMessageId = `msg_${Date.now()}`;
    await DB.prepare("INSERT INTO Messages (id, chatId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)")
          .bind(userMessageId, chatId, userMessage.role, userMessage.content, new Date().toISOString())
          .run();

    const apiURL = "https://api.deepseek.com/chat/completions";
    const payload = { model: chatData.model, messages, temperature: chatData.temperature, stream: true };

    const apiResponse = await fetch(apiURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify(payload)
    });

    const [streamToClient, streamToDB] = apiResponse.body.tee();
    
    const saveFullResponse = async () => {
        const reader = streamToDB.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        try {
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
            if(fullResponse) {
                const aiMessageId = `msg_${Date.now()}_ai`;
                await DB.prepare("INSERT INTO Messages (id, chatId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)")
                      .bind(aiMessageId, chatId, 'assistant', fullResponse, new Date().toISOString())
                      .run();
            }
        } catch (e) { console.error('Erro ao salvar resposta no DB:', e); }
    };

    context.waitUntil(saveFullResponse());

    const responseWithChatId = new ReadableStream({
        start(controller) {
            controller.enqueue(`event: chat_id\ndata: ${JSON.stringify({ chatId })}\n\n`);
            const reader = streamToClient.getReader();
            function push() {
                reader.read().then(({ done, value }) => {
                    if (done) { controller.close(); return; }
                    controller.enqueue(value);
                    push();
                }).catch(error => { controller.error(error); });
            }
            push();
        }
    });
    
    return new Response(responseWithChatId, {
        headers: { 'Content-Type': 'text/event-stream' }
    });
});

// PUT /api/chats/:id -> Atualiza um chat (ex: fixar)
router.put('/api/chats/:id', withAuth, async (request, context) => {
    const { clerkUserId } = request;
    const chatId = request.params.id;
    const { DB } = context.env;
    const updates = await request.json();

    if (typeof updates.isPinned !== 'undefined') {
        await DB.prepare("UPDATE Chats SET isPinned = ? WHERE id = ? AND clerkUserId = ?")
              .bind(updates.isPinned, chatId, clerkUserId)
              .run();
    }
    return jsonResponse({ success: true });
});

// DELETE /api/chats/:id -> Deleta um chat
router.delete('/api/chats/:id', withAuth, async (request, context) => {
    const { clerkUserId } = request;
    const chatId = request.params.id;
    const { DB } = context.env;
    await DB.prepare("DELETE FROM Chats WHERE id = ? AND clerkUserId = ?").bind(chatId, clerkUserId).run();
    return jsonResponse({ success: true });
});

// Rota de fallback para 404
router.all('*', () => jsonResponse({ error: 'Rota não encontrada' }, 404));

// Handler principal
export const onRequest = (context) => {
    const url = new URL(context.request.url);
    if (url.pathname === '/api/clerk-key') {
        return jsonResponse({ key: context.env.PUBLIC_CLERK_PUBLISHABLE_KEY });
    }
    return router.handle(context.request, context);
};