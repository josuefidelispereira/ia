// functions/chat.js

async function handleRequest(context) {
    // 1. Apenas permitir requisições do tipo POST
    if (context.request.method !== 'POST') {
        return new Response('Método não permitido', { status: 405 });
    }

    try {
        // 2. Pegar a chave da API e a mensagem do usuário
        const DEEPSEEK_API_KEY = context.env.DEEPSEEK_API_KEY;
        const requestData = await context.request.json();
        const userMessages = requestData.messages; // Agora recebemos um histórico

        if (!DEEPSEEK_API_KEY) {
            // Retorna um erro formatado que o frontend pode exibir
            const errorPayload = JSON.stringify({ error: "A chave da API não foi configurada no ambiente da Cloudflare." });
            return new Response(errorPayload, { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (!userMessages || userMessages.length === 0) {
            const errorPayload = JSON.stringify({ error: "Nenhuma mensagem fornecida." });
            return new Response(errorPayload, { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
             });
        }

        // 3. Preparar a chamada para a API da DeepSeek com streaming ativado
        const apiURL = "https://api.deepseek.com/chat/completions";
        
        const payload = {
            model: "deepseek-chat",
            messages: userMessages,
            stream: true // Habilita o streaming
        };

        const apiResponse = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        // 4. Retornar a resposta como um stream para o frontend
        // O corpo da resposta da API já é um stream. Nós simplesmente o repassamos.
        return new Response(apiResponse.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (e) {
        console.error("Erro na Cloudflare Function:", e);
        const errorPayload = JSON.stringify({ error: `Ocorreu um erro inesperado no servidor.` });
        return new Response(errorPayload, {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export const onRequest = handleRequest;