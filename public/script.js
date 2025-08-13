// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const sidebar = document.getElementById('sidebar');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchInput = document.getElementById('search-input');
    const chatHistory = document.getElementById('chat-history');
    const welcomeView = document.getElementById('welcome-view');
    const chatContainer = document.getElementById('chat-container');
    const chatWindow = document.getElementById('chat-window');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // --- ESTADO DA APLICAÇÃO ---
    let currentChatId = null;
    let conversations = {};

    // --- FUNÇÕES DE LÓGICA ---
    
    // Função para rolar o chat para o final
    const scrollToBottom = () => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // Cria os botões de ação para as mensagens da IA
    const createActionButtons = (messageContentDiv, getFullText) => {
        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'action-buttons';

        // Botão de Copiar
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.title = 'Copiar';
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(getFullText()).then(() => {
                copyBtn.innerHTML = `✓`;
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                }, 1500);
            });
        };

        // Botão de Download
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'action-btn';
        downloadBtn.title = 'Download';
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadBtn.onclick = () => {
            const textToDownload = getFullText();
            const blob = new Blob([textToDownload], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resposta-ia-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        actionsWrapper.appendChild(copyBtn);
        actionsWrapper.appendChild(downloadBtn);
        messageContentDiv.parentElement.appendChild(actionsWrapper);
    };

    // Adiciona uma mensagem (usuário ou IA) à janela de chat
    const addMessageToUI = (role, content = '') => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper', role);

        const roleDiv = document.createElement('div');
        roleDiv.classList.add('message-role');
        roleDiv.textContent = role === 'user' ? 'Você' : 'Assistente IA';
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        if (role === 'user') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = content;
        }
        
        wrapper.appendChild(roleDiv);
        wrapper.appendChild(contentDiv);
        chatWindow.appendChild(wrapper);

        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';

        scrollToBottom();
        return contentDiv;
    };

    // Lida com o envio do formulário
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        if (!currentChatId) {
            currentChatId = `chat_${Date.now()}`;
            conversations[currentChatId] = {
                title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
                messages: []
            };
        }

        conversations[currentChatId].messages.push({ role: 'user', content: userMessage });
        addMessageToUI('user', userMessage);
        
        // ***** MUDANÇA PRINCIPAL DESTA VERSÃO *****
        // Rola para a mensagem do usuário imediatamente
        scrollToBottom(); 
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendButton.disabled = true;

        const aiMessageContent = addMessageToUI('ia');
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
            
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
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
                                
                                aiMessageContent.innerHTML = marked.parse(aiResponseText);
                                aiMessageContent.appendChild(cursor);
                                scrollToBottom();
                            }
                        } catch (e) {}
                    }
                }
            }
            
            cursor.remove();
            aiMessageContent.innerHTML = marked.parse(aiResponseText); 
            
            conversations[currentChatId].messages.push({ role: 'assistant', content: aiResponseText });
            createActionButtons(aiMessageContent, () => aiResponseText);
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
    const saveConversations = () => localStorage.setItem('chatConversations', JSON.stringify(conversations));
    const loadConversations = () => {
        const saved = localStorage.getItem('chatConversations');
        if (saved) conversations = JSON.parse(saved);
    };
    
    const renderChatHistory = (filter = '') => {
        chatHistory.innerHTML = '';
        Object.keys(conversations)
            .reverse()
            .filter(id => conversations[id].title.toLowerCase().includes(filter.toLowerCase()))
            .forEach(id => {
                const item = document.createElement('div');
                item.classList.add('history-item');
                item.textContent = conversations[id].title;
                item.dataset.chatId = id;
                if (id === currentChatId) item.classList.add('active');
                chatHistory.appendChild(item);
            });
    };
    
    const startNewChat = () => {
        currentChatId = null;
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'flex';
        chatWindow.style.display = 'none';
        messageInput.value = '';
        renderChatHistory();
        sidebar.classList.remove('visible');
    };
    
    const loadChat = (chatId) => {
        if (!conversations[chatId]) return;
        currentChatId = chatId;
        
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';

        conversations[chatId].messages.forEach(msg => {
            const contentDiv = addMessageToUI(msg.role, msg.content);
            if (msg.role === 'ia') {
                createActionButtons(contentDiv, () => msg.content);
            }
        });

        renderChatHistory();
        sidebar.classList.remove('visible');
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
    searchInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
    chatHistory.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('history-item')) {
            loadChat(e.target.dataset.chatId);
        }
    });
    menuToggleBtn.addEventListener('click', () => sidebar.classList.toggle('visible'));

    // --- INICIALIZAÇÃO ---
    const initializeApp = () => {
        loadConversations();
        renderChatHistory();
        startNewChat();
    };

    initializeApp();
});