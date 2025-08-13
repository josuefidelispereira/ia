// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchInput = document.getElementById('search-input');
    const chatHistory = document.getElementById('chat-history');
    const welcomeView = document.getElementById('welcome-view');
    const chatWindow = document.getElementById('chat-window');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // --- ESTADO DA APLICAÇÃO ---
    let currentChatId = null;
    let conversations = {}; // Armazena todas as conversas: { "id": { title: "...", messages: [] } }

    // --- FUNÇÕES DE CHAT E MENSAGENS ---

    // Adiciona uma mensagem (usuário ou IA) à janela de chat
    const addMessageToUI = (role, content) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper', role);

        const roleDiv = document.createElement('div');
        roleDiv.classList.add('message-role');
        roleDiv.textContent = role === 'user' ? 'Você' : 'Assistente IA';
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = content; // Para o usuário, o conteúdo é simples
        
        wrapper.appendChild(roleDiv);
        wrapper.appendChild(contentDiv);
        chatWindow.appendChild(wrapper);

        // Esconde a tela de boas-vindas
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';

        chatWindow.scrollTop = chatWindow.scrollHeight;
        return contentDiv; // Retorna o elemento de conteúdo para streaming
    };

    // Lida com o envio do formulário
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        // Se é uma nova conversa, cria um ID e título
        if (!currentChatId) {
            currentChatId = `chat_${Date.now()}`;
            conversations[currentChatId] = {
                title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
                messages: []
            };
        }

        // Adiciona a mensagem do usuário ao estado e à UI
        conversations[currentChatId].messages.push({ role: 'user', content: userMessage });
        addMessageToUI('user', userMessage);
        
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reseta a altura do textarea
        sendButton.disabled = true;

        // Cria o container para a resposta da IA e o cursor piscando
        const aiMessageContent = addMessageToUI('ia', '');
        const cursor = document.createElement('span');
        cursor.classList.add('blinking-cursor');
        aiMessageContent.appendChild(cursor);

        // --- LÓGICA DE STREAMING ---
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: conversations[currentChatId].messages })
            });
            
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Processa os eventos Server-Sent
                const lines = chunk.split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr.trim() === '[DONE]') continue;
                        try {
                            const parsedData = JSON.parse(dataStr);
                            if (parsedData.choices && parsedData.choices[0].delta.content) {
                                const textChunk = parsedData.choices[0].delta.content;
                                aiResponseText += textChunk;
                                // Atualiza o conteúdo, mantendo o cursor no final
                                aiMessageContent.textContent = aiResponseText;
                                aiMessageContent.appendChild(cursor);
                            }
                        } catch (e) {
                            // Ignora erros de parsing de JSON em chunks incompletos
                        }
                    }
                }
            }
            
            // Finaliza a resposta
            cursor.remove(); // Remove o cursor
            aiMessageContent.textContent = aiResponseText; // Garante o conteúdo final
            conversations[currentChatId].messages.push({ role: 'assistant', content: aiResponseText });
            saveConversations();
            renderChatHistory();

        } catch (error) {
            console.error('Erro no streaming:', error);
            aiMessageContent.textContent = `Desculpe, ocorreu um erro: ${error.message}`;
            cursor.remove();
        } finally {
            sendButton.disabled = false;
        }
    };
    
    // Ajusta a altura do textarea dinamicamente
    const handleInput = () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    };

    // --- FUNÇÕES DE HISTÓRICO E LOCAL STORAGE ---

    // Salva todas as conversas no Local Storage
    const saveConversations = () => {
        localStorage.setItem('chatConversations', JSON.stringify(conversations));
    };

    // Carrega as conversas do Local Storage
    const loadConversations = () => {
        const saved = localStorage.getItem('chatConversations');
        if (saved) {
            conversations = JSON.parse(saved);
        }
    };
    
    // Renderiza a barra lateral com o histórico
    const renderChatHistory = (filter = '') => {
        chatHistory.innerHTML = '';
        Object.keys(conversations)
            .reverse() // Mostra os mais recentes primeiro
            .filter(id => conversations[id].title.toLowerCase().includes(filter.toLowerCase()))
            .forEach(id => {
                const item = document.createElement('div');
                item.classList.add('history-item');
                item.textContent = conversations[id].title;
                item.dataset.chatId = id;
                if (id === currentChatId) {
                    item.classList.add('active');
                }
                chatHistory.appendChild(item);
            });
    };
    
    // Inicia uma nova conversa
    const startNewChat = () => {
        currentChatId = null;
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'flex';
        chatWindow.style.display = 'none';
        messageInput.value = '';
        renderChatHistory(); // Para remover a seleção 'active'
    };
    
    // Carrega uma conversa do histórico
    const loadChat = (chatId) => {
        if (!conversations[chatId]) return;
        currentChatId = chatId;
        
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';

        conversations[chatId].messages.forEach(msg => {
            addMessageToUI(msg.role, msg.content);
        });

        renderChatHistory();
    };

    // --- EVENT LISTENERS ---
    messageForm.addEventListener('submit', handleFormSubmit);
    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageForm.requestSubmit();
        }
    });

    newChatBtn.addEventListener('click', startNewChat);
    
    searchInput.addEventListener('input', (e) => {
        renderChatHistory(e.target.value);
    });

    chatHistory.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('history-item')) {
            loadChat(e.target.dataset.chatId);
        }
    });

    // --- INICIALIZAÇÃO ---
    const initializeApp = () => {
        loadConversations();
        renderChatHistory();
        startNewChat(); // Começa sempre com a tela de boas-vindas
    };

    initializeApp();
});