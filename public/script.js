// public/script.js (VERSÃO PROFISSIONAL COM AUTH E DB)
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const appContent = document.getElementById('app-content');
    const signInContainer = document.getElementById('sign-in-container');
    const clerkSignInDiv = document.getElementById('clerk-sign-in');
    const clerkUserButtonDiv = document.getElementById('clerk-user-button');
    const clerkScript = document.getElementById('clerk-script');
    // ... (outros seletores de elementos do DOM)

    // --- ESTADO DA APLICAÇÃO ---
    let clerk = null;
    let currentChatId = null;
    let conversations = {}; // Cache local dos chats do servidor
    let messagesCache = {}; // Cache local das mensagens de cada chat
    let currentAbortController = null;
    // (Configurações como temperatura, etc. podem ser adicionadas aqui depois)

    // --- FUNÇÕES DE API ---
    const getAuthToken = async () => clerk.session.getToken();
    
    const fetchWithAuth = async (url, options = {}) => {
        const token = await getAuthToken();
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        return fetch(url, { ...options, headers });
    };

    // --- LÓGICA DE INICIALIZAÇÃO E AUTENTICAÇÃO ---
    const loadClerk = async () => {
        // Busca a chave publicável do nosso backend para não expô-la no HTML
        const response = await fetch('/api/clerk-key');
        const { key } = await response.json();
        
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@4/dist/clerk.browser.js`;
            script.async = true;
            script.onload = () => {
                const Clerk = window.Clerk;
                const clerkInstance = new Clerk(key);
                clerkInstance.load().then(() => resolve(clerkInstance));
            };
            document.head.appendChild(script);
        });
    };

    const initializeAuth = async () => {
        clerk = await loadClerk();
        
        clerk.addListener(({ user }) => {
            if (user) {
                signInContainer.style.display = 'none';
                appContent.style.display = 'block';
                clerk.mountUserButton(clerkUserButtonDiv);
                initializeAppChat(); // Inicia o app de chat de fato
            } else {
                appContent.style.display = 'none';
                signInContainer.style.display = 'block';
                clerk.mountSignIn(clerkSignInDiv, {
                    appearance: {
                        variables: { colorPrimary: '#5865f2' }
                    }
                });
            }
        });
    };

    // --- LÓGICA DE CHAT (AGORA COM API) ---
    const loadConversations = async () => {
        try {
            const response = await fetchWithAuth('/api/chats');
            const chatsFromServer = await response.json();
            conversations = {};
            chatsFromServer.forEach(chat => { conversations[chat.id] = chat; });
            renderChatHistory();
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
        }
    };
    
    const loadChat = async (chatId) => {
        currentChatId = chatId;
        // Limpa a tela
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';
        
        // Busca as mensagens da API se ainda não estiverem em cache
        if (!messagesCache[chatId]) {
            const response = await fetchWithAuth(`/api/chats/${chatId}/messages`);
            messagesCache[chatId] = await response.json();
        }
        
        // Renderiza as mensagens
        messagesCache[chatId].forEach(addMessageToUI);
        
        renderChatHistory();
        closeSidebarMobile();
    };

    const deleteChat = async (chatId) => {
        if (confirm(`Tem certeza que deseja excluir esta conversa?`)) {
            await fetchWithAuth(`/api/chats/${chatId}`, { method: 'DELETE' });
            delete conversations[chatId];
            delete messagesCache[chatId];
            if (currentChatId === chatId) startNewChat();
            renderChatHistory();
        }
    };
    
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        // ... (A lógica de streaming será muito parecida, mas a chamada fetch agora é para /api/stream)
        // E o backend cuidará de salvar tudo no banco de dados.
        // O frontend só precisa enviar a mensagem e renderizar o stream.
    };

    // --- FUNÇÕES DE UI (a maioria permanece a mesma) ---
    // startNewChat, renderChatHistory (com pequenas adaptações), etc.
    // ...

    // --- INICIALIZAÇÃO PRINCIPAL DO APP ---
    const initializeAppChat = () => {
        // ... (todos os seus event listeners e funções de UI, como renderChatHistory, etc.)
        loadConversations();
        startNewChat();
    };

    initializeAuth();
});
// Nota: Este script é uma reescrita completa e complexa. 
// A lógica para cada função (delete, pin, etc.) agora precisa de uma chamada `fetch` correspondente.
// A estrutura acima é o guia para essa implementação.