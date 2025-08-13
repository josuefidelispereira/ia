// functions/chat.js
export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response('Método não permitido', { status: 405 });
    }

    try {
        const DEEPSEEK_API_KEY = context.env.DEEPSEEK_API_KEY;
        const requestData = await context.request.json();
        
        // Extrai os novos parâmetros do corpo da requisição
        const { messages, model, temperature } = requestData;

        if (!DEEPSEEK_API_KEY) {
            return new Response(JSON.stringify({ error: "Chave da API não configurada." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ error: "Nenhuma mensagem." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const apiURL = "https://api.deepseek.com/chat/completions";
        
        const payload = {
            model: model || "deepseek-chat", // Usa o modelo enviado, ou um padrão
            messages: messages,
            temperature: temperature || 1.0, // Usa a temperatura enviada, ou um padrão
            stream: true
        };

        const apiResponse = await fetch(apiURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify(payload)
        });

        return new Response(apiResponse.body, {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: `Erro no servidor: ${e.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}