// public/script-teste.js
console.log("--- INICIANDO TESTE DE DIAGNÓSTICO ---");

const signInDiv = document.getElementById('clerk-sign-in');
if (!signInDiv) {
    console.error("FALHA: O div #clerk-sign-in não foi encontrado no HTML.");
}

const initializeClerkTest = async () => {
    try {
        console.log("Passo 1: Buscando a chave do Clerk do backend...");
        const res = await fetch('/api/clerk-key');
        console.log("Resposta do fetch recebida. Status:", res.status);
        if (!res.ok) throw new Error(`Falha ao buscar chave. Status: ${res.status}`);

        const { key } = await res.json();
        if (!key) throw new Error("A chave recebida do backend está vazia.");
        console.log("Passo 2: Chave do Clerk recebida com sucesso.");

        console.log("Passo 3: Criando tag de script para carregar a biblioteca do Clerk...");
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@4/dist/clerk.browser.js`;
            script.async = true;
            script.onload = () => {
                console.log("Passo 4: Script do Clerk carregado via 'onload'.");
                resolve();
            };
            script.onerror = () => reject(new Error("Falha ao carregar o SCRIPT do Clerk a partir do CDN. Verifique a conexão ou bloqueadores."));
            document.head.appendChild(script);
        });

        console.log("Passo 5: Verificando se window.Clerk existe...");
        const Clerk = window.Clerk;
        if (!Clerk) {
            throw new Error("Biblioteca do Clerk foi baixada, mas o objeto 'window.Clerk' não foi definido. Possível bloqueio de execução do script.");
        }
        console.log("Passo 6: window.Clerk encontrado. Tentando instanciar...");

        const clerk = new Clerk(key);
        console.log("Passo 7: Instância do Clerk criada. Carregando a instância...");

        await clerk.load();
        console.log("Passo 8: Instância do Clerk carregada com sucesso.");

        console.log("Passo 9: Tentando montar o componente de SignIn...");
        clerk.mountSignIn(signInDiv);
        console.log("--- TESTE CONCLUÍDO COM SUCESSO! ---");

    } catch (error) {
        console.error("--- TESTE FALHOU ---");
        console.error("ERRO DETALHADO:", error);
        signInDiv.innerHTML = `<p style="color: red;">O teste falhou. Verifique o console para detalhes do erro. Detalhe: ${error.message}</p>`;
    }
};

initializeClerkTest();