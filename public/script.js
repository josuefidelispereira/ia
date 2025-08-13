// public/script.js (VERSÃO PROFISSIONAL COM AUTH E DB)
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const appContent = document.getElementById('app-content');
    const signInContainer = document.getElementById('sign-in-container');
    const clerkSignInDiv = document.getElementById('clerk-sign-in');
    const clerkUserButtonDiv = document.getElementById('clerk-user-button');
    // ... (todos os outros seletores de elementos do DOM)

    // --- ESTADO DA APLICAÇÃO ---
    let clerk = null;
    let currentChatId = null;
    let conversations = {}; // Cache local dos chats do servidor
    let messagesCache = {}; // Cache local das mensagens de cada chat
    
    // --- FUNÇÕES DE API ---
    const getAuthToken = async () => clerk.session.getToken();
    const fetchWithAuth = async (url, options = {}) => {
        const token = await getAuthToken();
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        return fetch(url, { ...options, headers });
    };

    // --- INICIALIZAÇÃO E AUTENTICAÇÃO (CLERK) ---
    const initializeAuth = async () => {
        try {
            const res = await fetch('/api/clerk-key');
            if (!res.ok) throw new Error("Falha ao buscar chave do Clerk.");
            const { key } = await res.json();
            
            const Clerk = window.Clerk;
            clerk = new Clerk(key);
            
            await clerk.load();

            clerk.addListener(({ user }) => {
                if (user) {
                    signInContainer.style.display = 'none';
                    appContent.style.display = 'block';
                    clerk.mountUserButton(clerkUserButtonDiv);
                    initializeAppChat();
                } else {
                    appContent.style.display = 'none';
                    signInContainer.style.display = 'block';
                    clerk.mountSignIn(clerkSignInDiv);
                }
            });
        } catch (error) {
            console.error(error);
            signInContainer.innerHTML = "<h1>Erro ao carregar a aplicação. Tente novamente mais tarde.</h1>";
        }
    };
    
    // --- LÓGICA DE CHAT (AGORA COM API) ---
    const loadConversations = async () => {
        const response = await fetchWithAuth('/api/chats');
        const chatsFromServer = await response.json();
        conversations = {};
        chatsFromServer.forEach(chat => { conversations[chat.id] = chat; });
        renderChatHistory();
    };

    const loadChat = async (chatId) => {
        currentChatId = chatId;
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';
        
        if (!messagesCache[chatId]) {
            const response = await fetchWithAuth(`/api/chats/${chatId}/messages`);
            messagesCache[chatId] = await response.json();
        }
        
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

    const pinChat = async (chatId) => {
        const isCurrentlyPinned = conversations[chatId].isPinned;
        await fetchWithAuth(`/api/chats/${chatId}`, {
            method: 'PUT',
            body: JSON.stringify({ isPinned: !isCurrentlyPinned })
        });
        conversations[chatId].isPinned = !isCurrentlyPinned; // Atualiza o cache local
        renderChatHistory(); // Re-renderiza para refletir a nova ordem
    };

    // ... (A função handleFormSubmit agora precisa chamar /api/stream)
    // ... (A função addMessageToUI permanece muito similar)
    // ... (A função renderChatHistory precisa ser adaptada para usar os dados de 'conversations')
    // A complexidade de reescrever todas as funções de UI é alta, o ideal é adaptar
    // as funções da Fase 1 para usarem 'fetchWithAuth' em vez de 'localStorage'.
    
    // --- INICIALIZAÇÃO DO APP DE CHAT (APÓS LOGIN) ---
    const initializeAppChat = () => {
        console.log("App de Chat Iniciado!");
        // Aqui dentro viriam todos os seus event listeners (newChatBtn, messageForm, etc.)
        // e as chamadas iniciais, como loadConversations().
        loadConversations();
    };
    
    // Ponto de entrada
    initializeAuth();
});