// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const sidebar = document.getElementById('sidebar');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const newChatBtn = document.getElementById('new-chat-btn');
    const searchInput = document.getElementById('search-input');
    const chatHistory = document.getElementById('chat-history');
    const welcomeView = document.getElementById('welcome-view');
    const chatContainer = document.getElementById('chat-container');
    const chatWindow = document.getElementById('chat-window');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');

    // --- ESTADO DA APLICAÇÃO ---
    let currentChatId = null;
    let conversations = {};
    let stagedAttachment = null;
    let currentAbortController = null; // Para a função de parar a geração

    // --- LÓGICA DE ANEXOS (VISUAL) ---
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                stagedAttachment = { type: 'image', dataUrl: e.target.result, name: file.name };
                renderAttachmentPreview();
            };
            reader.readAsDataURL(file);
        } else {
            alert('Apenas imagens podem ser pré-visualizadas no momento.');
        }
        fileInput.value = ''; // Permite selecionar o mesmo arquivo novamente
    };

    const renderAttachmentPreview = () => {
        attachmentPreview.innerHTML = '';
        if (stagedAttachment?.type === 'image') {
            attachmentPreview.style.display = 'flex';
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            const img = document.createElement('img');
            img.src = stagedAttachment.dataUrl;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-preview-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                stagedAttachment = null;
                renderAttachmentPreview();
            };
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            attachmentPreview.appendChild(previewItem);
        } else {
            attachmentPreview.style.display = 'none';
        }
    };

    // --- LÓGICA DE CHAT E MENSAGENS ---
    const scrollToBottom = () => chatContainer.scrollTop = chatContainer.scrollHeight;

    const createActionButtons = (getFullText) => {
        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'action-buttons';

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

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'action-btn';
        downloadBtn.title = 'Download';
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadBtn.onclick = () => {
            const textToDownload = getFullText();
            const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resposta-ia-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        };
        actionsWrapper.appendChild(copyBtn);
        actionsWrapper.appendChild(downloadBtn);
        return actionsWrapper;
    };

    const addMessageToUI = (message) => {
        const { role, content, attachment } = message;
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper', role);
        const roleDiv = document.createElement('div');
        roleDiv.classList.add('message-role');
        roleDiv.textContent = role === 'user' ? 'Você' : 'Assistente IA';
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        if (role === 'user') {
            contentDiv.textContent = content;
            if (attachment?.type === 'image') {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'message-attachment';
                const img = document.createElement('img');
                img.src = attachment.dataUrl;
                imgWrapper.appendChild(img);
                contentDiv.appendChild(imgWrapper);
            }
        } else {
            contentDiv.innerHTML = marked.parse(content || '');
            if (content) { // Só adiciona botões se houver conteúdo (não para o container vazio inicial)
                const buttons = createActionButtons(() => content);
                wrapper.appendChild(buttons);
            }
        }
        wrapper.appendChild(roleDiv);
        wrapper.appendChild(contentDiv);
        chatWindow.appendChild(wrapper);
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';
        scrollToBottom();
        return contentDiv;
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        
        if (sendButton.classList.contains('stop-button')) {
            if (currentAbortController) {
                currentAbortController.abort();
            }
            return;
        }

        const userMessage = messageInput.value.trim();
        if (!userMessage && !stagedAttachment) return;

        if (!currentChatId) {
            currentChatId = `chat_${Date.now()}`;
            conversations[currentChatId] = {
                title: (userMessage || "Chat com anexo").substring(0, 30) + '...',
                messages: [],
                isPinned: false
            };
        }

        const messagePayload = { role: 'user', content: userMessage, attachment: stagedAttachment };
        conversations[currentChatId].messages.push(messagePayload);
        addMessageToUI(messagePayload);
        scrollToBottom();

        stagedAttachment = null;
        renderAttachmentPreview();
        messageInput.value = '';
        messageInput.style.height = 'auto';

        const aiMessageContent = addMessageToUI({ role: 'ia' });
        const cursor = document.createElement('span');
        cursor.classList.add('blinking-cursor');
        aiMessageContent.appendChild(cursor);

        currentAbortController = new AbortController();
        setSendButtonState(true);

        try {
            const messagesForApi = conversations[currentChatId].messages.map(m => ({ role: m.role, content: m.content }));
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesForApi }),
                signal: currentAbortController.signal
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
                                aiResponseText += parsedData.choices[0].delta.content;
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
            const actionButtons = createActionButtons(() => aiResponseText);
            aiMessageContent.parentElement.appendChild(actionButtons);
            conversations[currentChatId].messages.push({ role: 'assistant', content: aiResponseText });
            saveConversations();
            renderChatHistory();
        } catch (error) {
            if (error.name === 'AbortError') {
                aiMessageContent.innerHTML = marked.parse(aiMessageContent.textContent.replace('▋', '')); // Remove cursor
                aiMessageContent.innerHTML += "<br><small><i>Geração interrompida.</i></small>";
            } else {
                console.error('Erro no streaming:', error);
                aiMessageContent.textContent = `Desculpe, ocorreu um erro: ${error.message}`;
            }
            cursor.remove();
        } finally {
            setSendButtonState(false);
            currentAbortController = null;
        }
    };

    const setSendButtonState = (isStopping) => {
        if (isStopping) {
            sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>`;
            sendButton.title = "Parar geração";
            sendButton.classList.add('stop-button');
        } else {
            sendButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
            sendButton.title = "Enviar Mensagem";
            sendButton.classList.remove('stop-button');
        }
    };

    // --- FUNÇÕES DE HISTÓRICO ---
    const saveConversations = () => localStorage.setItem('chatConversations', JSON.stringify(conversations));
    const loadConversations = () => {
        const saved = localStorage.getItem('chatConversations');
        if (saved) conversations = JSON.parse(saved);
    };

    const renderChatHistory = (filter = '') => {
        chatHistory.innerHTML = '';
        const chatIds = Object.keys(conversations);
        const createItem = (id) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'history-item-wrapper';
            const itemBtn = document.createElement('button');
            itemBtn.className = 'history-item';
            if (id === currentChatId) itemBtn.classList.add('active');
            if (conversations[id].isPinned) itemBtn.classList.add('pinned');
            const pinIcon = document.createElement('span');
            pinIcon.className = 'pin-icon';
            pinIcon.textContent = conversations[id].isPinned ? '📌' : '';
            const titleSpan = document.createElement('span');
            titleSpan.textContent = conversations[id].title;
            itemBtn.appendChild(pinIcon);
            itemBtn.appendChild(titleSpan);
            itemBtn.onclick = () => loadChat(id);
            const optionsBtn = document.createElement('button');
            optionsBtn.className = 'history-options-btn';
            optionsBtn.innerHTML = '...';
            optionsBtn.onclick = (e) => { e.stopPropagation(); toggleContextMenu(id, e.currentTarget); };
            wrapper.appendChild(itemBtn);
            wrapper.appendChild(optionsBtn);
            chatHistory.appendChild(wrapper);
        };
        const filteredIds = chatIds.filter(id => conversations[id].title.toLowerCase().includes(filter.toLowerCase()));
        const pinnedChats = filteredIds.filter(id => conversations[id].isPinned).sort((a,b) => b.localeCompare(a));
        const unpinnedChats = filteredIds.filter(id => !conversations[id].isPinned).sort((a,b) => b.localeCompare(a));
        pinnedChats.forEach(createItem);
        unpinnedChats.forEach(createItem);
    };

    const toggleContextMenu = (chatId, target) => {
        document.querySelector('.history-context-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'history-context-menu visible';
        const pinText = conversations[chatId].isPinned ? 'Desafixar' : 'Fixar';
        menu.innerHTML = `<button class="context-menu-btn" data-action="pin" data-id="${chatId}">${pinText}</button><button class="context-menu-btn delete" data-action="delete" data-id="${chatId}">Excluir</button>`;
        target.parentElement.appendChild(menu);
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    };
    
    const handleHistoryActions = (e) => {
        const button = e.target.closest('.context-menu-btn');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;
            if (action === 'pin') pinChat(id);
            if (action === 'delete') deleteChat(id);
        }
    };
    
    const deleteChat = (chatId) => {
        if (confirm(`Tem certeza que deseja excluir a conversa "${conversations[chatId].title}"?`)) {
            delete conversations[chatId];
            saveConversations();
            if (currentChatId === chatId) startNewChat();
            renderChatHistory();
        }
    };

    const pinChat = (chatId) => {
        conversations[chatId].isPinned = !conversations[chatId].isPinned;
        saveConversations();
        renderChatHistory();
    };
    
    const startNewChat = () => { currentChatId = null; chatWindow.innerHTML = ''; welcomeView.style.display = 'flex'; chatWindow.style.display = 'none'; messageInput.value = ''; stagedAttachment = null; renderAttachmentPreview(); renderChatHistory(); closeSidebarMobile(); };
    
    const loadChat = (chatId) => {
        if (!conversations[chatId]) return;
        currentChatId = chatId;
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';
        conversations[chatId].messages.forEach(addMessageToUI);
        renderChatHistory();
        closeSidebarMobile();
    };

    const handleInput = () => { messageInput.style.height = 'auto'; messageInput.style.height = `${messageInput.scrollHeight}px`; };
    const closeSidebarMobile = () => { sidebar.classList.remove('visible'); sidebarOverlay.classList.remove('visible'); };

    // --- EVENT LISTENERS ---
    messageForm.addEventListener('submit', handleFormSubmit);
    sendButton.addEventListener('click', (e) => { if (sendButton.classList.contains('stop-button')) handleFormSubmit(e); });
    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); messageForm.requestSubmit(); } });
    fileInput.addEventListener('change', handleFileSelect);
    newChatBtn.addEventListener('click', startNewChat);
    searchInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
    chatHistory.addEventListener('click', handleHistoryActions);
    menuToggleBtn.addEventListener('click', () => { sidebar.classList.toggle('visible'); sidebarOverlay.classList.toggle('visible'); });
    sidebarOverlay.addEventListener('click', closeSidebarMobile);

    // --- INICIALIZAÇÃO ---
    const initializeApp = () => { loadConversations(); renderChatHistory(); startNewChat(); };
    initializeApp();
});