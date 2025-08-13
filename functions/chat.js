// functions/chat.js

// A função onRequest é o ponto de entrada para a nossa Cloudflare Function.
// O parâmetro 'context' nos dá acesso a informações da requisição e variáveis de ambiente.
export async function onRequest(context) {
    // 1. Apenas permitir requisições do tipo POST
    if (context.request.method !== 'POST') {
        return new Response('Método não permitido', { status: 405 });
    }

    try {
        // 2. Pegar a chave da API de forma segura das variáveis de ambiente da Cloudflare
        //    Você vai configurar isso no painel da Cloudflare. A chave NUNCA fica no código.
        const DEEPSEEK_API_KEY = context.env.DEEPSEEK_API_KEY;

        if (!DEEPSEEK_API_KEY) {
            return new Response(JSON.stringify({ error: "A chave da API não foi configurada no ambiente da Cloudflare." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // 3. Ler a mensagem do usuário que veio do frontend
        const requestData = await context.request.json();
        const userMessage = requestData.message;

        if (!userMessage) {
            return new Response(JSON.stringify({ error: "Nenhuma mensagem fornecida." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 4. Preparar e fazer a chamada para a API da DeepSeek
        const apiURL = "https://api.deepseek.com/chat/completions";
        
        const payload = {
            model: "deepseek-chat",
            messages: [
                { "role": "system", "content": "Você é um assistente prestativo." },
                { "role": "user", "content": userMessage }
            ]
        };

        const apiResponse = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        // Se a resposta da DeepSeek não for bem-sucedida, lança um erro.
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`Erro da API DeepSeek: ${apiResponse.status} ${errorText}`);
        }

        const responseData = await apiResponse.json();
        const aiMessage = responseData.choices[0].message.content;

        // 5. Enviar a resposta da IA de volta para o nosso frontend
        const responsePayload = JSON.stringify({ reply: aiMessage });

        return new Response(responsePayload, {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (e) {
        // Captura qualquer erro que acontecer no processo
        console.error("Erro na Cloudflare Function:", e);
        const errorPayload = JSON.stringify({ error: `Ocorreu um erro no servidor: ${e.message}` });
        
        return new Response(errorPayload, {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}