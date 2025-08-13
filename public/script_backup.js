// public/script.js (VERSÃO 100% CORRIGIDA E COMPLETA)
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const appContent = document.getElementById('app-content');
    const signInContainer = document.getElementById('sign-in-container');
    const clerkSignInDiv = document.getElementById('clerk-sign-in');
    const clerkUserButtonDiv = document.getElementById('clerk-user-button');
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
    let clerk = null;
    let currentChatId = null;
    let conversations = {};
    let messagesCache = {};
    let currentAbortController = null;
    let stagedAttachment = null;
    let appSettings = { model: 'deepseek-chat', temperature: 1.0, systemPrompt: 'Você é um assistente prestativo.' };

    // --- LÓGICA DE INICIALIZAÇÃO E AUTENTICAÇÃO (CORRIGIDA) ---
    const initializeAuth = async () => {
        try {
            const res = await fetch('/api/clerk-key');
            if (!res.ok) throw new Error("Falha ao buscar chave do Clerk do backend.");
            const { key } = await res.json();
            if (!key) throw new Error("Chave do Clerk não recebida do backend.");

            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@4/dist/clerk.browser.js`;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Falha ao carregar o script do Clerk a partir do CDN."));
                document.head.appendChild(script);
            });
            
            const Clerk = window.Clerk;
            if (!Clerk) throw new Error("Biblioteca do Clerk não carregou corretamente.");

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
            console.error("ERRO FATAL NA INICIALIZAÇÃO:", error);
            signInContainer.innerHTML = `<h1>Erro ao carregar a aplicação.</h1><p style="color: #aaa; font-size: 0.8em; margin-top: 1em;">Detalhe: ${error.message}</p>`;
        }
    };

    // --- FUNÇÕES DE API ---
    const getAuthToken = async () => clerk.session.getToken();
    const fetchWithAuth = async (url, options = {}) => {
        const token = await getAuthToken();
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        return fetch(url, { ...options, headers });
    };

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
        } else { alert('Apenas imagens podem ser pré-visualizadas.'); }
        fileInput.value = '';
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
            removeBtn.onclick = () => { stagedAttachment = null; renderAttachmentPreview(); };
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
            const a = document.createElement('a'); a.href = url;
            a.download = `resposta-ia-${Date.now()}.txt`; a.click();
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
            if (content) {
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

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        if (sendButton.classList.contains('stop-button')) {
            if (currentAbortController) currentAbortController.abort();
            return;
        }
        const userMessage = messageInput.value.trim();
        if (!userMessage && !stagedAttachment) return;
        const isNewChat = !currentChatId;
        const tempChatId = isNewChat ? `temp_${Date.now()}` : currentChatId;
        const messagePayload = { role: 'user', content: userMessage, attachment: stagedAttachment };
        if (isNewChat) { messagesCache[tempChatId] = [messagePayload]; } 
        else { messagesCache[currentChatId].push(messagePayload); }
        addMessageToUI(messagePayload);
        scrollToBottom();
        stagedAttachment = null; renderAttachmentPreview();
        messageInput.value = ''; messageInput.style.height = 'auto';
        const aiMessageContent = addMessageToUI({ role: 'ia' });
        const cursor = document.createElement('span');
        cursor.classList.add('blinking-cursor');
        aiMessageContent.appendChild(cursor);
        currentAbortController = new AbortController();
        setSendButtonState(true);
        try {
            const chatData = { id: isNewChat ? null : currentChatId, title: userMessage.substring(0, 40) + '...', ...appSettings };
            const messagesForApi = (messagesCache[tempChatId] || []).map(m => ({ role: m.role, content: m.content }));
            const response = await fetchWithAuth('/api/stream', {
                method: 'POST', body: JSON.stringify({ messages: messagesForApi, chatData }), signal: currentAbortController.signal
            });
            if (!response.ok) { throw new Error(await response.text()); }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';
            let receivedChatId = null;
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('event: chat_id')) {
                        receivedChatId = JSON.parse(line.split('data: ')[1]).chatId;
                    } else if (line.startsWith('data: ')) {
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
            const finalChatId = receivedChatId || currentChatId;
            if (!messagesCache[finalChatId]) messagesCache[finalChatId] = [];
            messagesCache[finalChatId].push({ role: 'assistant', content: aiResponseText });
            if (isNewChat && receivedChatId) {
                await loadConversations();
                currentChatId = receivedChatId;
                renderChatHistory();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                aiMessageContent.innerHTML = marked.parse(aiMessageContent.textContent.replace('▋', '')) + "<br><small><i>Geração interrompida.</i></small>";
            } else { aiMessageContent.textContent = `Desculpe, ocorreu um erro: ${error.message}`; }
            cursor.remove();
        } finally {
            setSendButtonState(false);
            currentAbortController = null;
        }
    };

    // --- LÓGICA DE HISTÓRICO ---
    const renderChatHistory = (filter = '') => {
        chatHistory.innerHTML = '';
        const chatIds = Object.keys(conversations);
        const createItem = (id) => {
            const wrapper = document.createElement('div'); wrapper.className = 'history-item-wrapper';
            const itemBtn = document.createElement('button'); itemBtn.className = 'history-item';
            if (id === currentChatId) itemBtn.classList.add('active');
            if (conversations[id].isPinned) itemBtn.classList.add('pinned');
            const pinIcon = document.createElement('span'); pinIcon.className = 'pin-icon';
            pinIcon.textContent = conversations[id].isPinned ? '📌' : '';
            const titleSpan = document.createElement('span'); titleSpan.textContent = conversations[id].title;
            itemBtn.appendChild(pinIcon); itemBtn.appendChild(titleSpan);
            itemBtn.onclick = () => loadChat(id);
            const optionsBtn = document.createElement('button'); optionsBtn.className = 'history-options-btn';
            optionsBtn.innerHTML = '...';
            optionsBtn.onclick = (e) => { e.stopPropagation(); toggleContextMenu(id, e.currentTarget); };
            wrapper.appendChild(itemBtn); wrapper.appendChild(optionsBtn);
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
        const menu = document.createElement('div'); menu.className = 'history-context-menu visible';
        const pinText = conversations[chatId].isPinned ? 'Desafixar' : 'Fixar';
        menu.innerHTML = `<button class="context-menu-btn" data-action="pin" data-id="${chatId}">${pinText}</button><button class="context-menu-btn delete" data-action="delete" data-id="${chatId}">Excluir</button>`;
        target.parentElement.appendChild(menu);
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    };

    const handleHistoryActions = (e) => {
        const button = e.target.closest('.context-menu-btn');
        if (button) {
            const action = button.dataset.action; const id = button.dataset.id;
            if (action === 'pin') pinChat(id);
            if (action === 'delete') deleteChat(id);
        }
    };
    
    const deleteChat = async (chatId) => {
        if (confirm(`Tem certeza que deseja excluir a conversa "${conversations[chatId].title}"?`)) {
            await fetchWithAuth(`/api/chats/${chatId}`, { method: 'DELETE' });
            delete conversations[chatId]; delete messagesCache[chatId];
            if (currentChatId === chatId) startNewChat();
            renderChatHistory();
        }
    };

    const pinChat = async (chatId) => {
        const isCurrentlyPinned = conversations[chatId].isPinned;
        await fetchWithAuth(`/api/chats/${chatId}`, { method: 'PUT', body: JSON.stringify({ isPinned: !isCurrentlyPinned }) });
        conversations[chatId].isPinned = !isCurrentlyPinned;
        renderChatHistory();
    };
    
    // --- FUNÇÕES DE CONTROLE DE UI ---
    const startNewChat = () => { currentChatId = null; chatWindow.innerHTML = ''; welcomeView.style.display = 'flex'; chatWindow.style.display = 'none'; messageInput.value = ''; stagedAttachment = null; renderAttachmentPreview(); renderChatHistory(); closeSidebarMobile(); };
    const closeSidebarMobile = () => { sidebar.classList.remove('visible'); sidebarOverlay.classList.remove('visible'); };
    const handleInput = () => { messageInput.style.height = 'auto'; messageInput.style.height = `${messageInput.scrollHeight}px`; };

    // --- INICIALIZAÇÃO DO APP DE CHAT (APÓS LOGIN) ---
    const initializeAppChat = () => {
        messageForm.addEventListener('submit', handleFormSubmit);
        sendButton.addEventListener('click', (e) => { if (sendButton.classList.contains('stop-button')) { e.preventDefault(); handleFormSubmit(e); }});
        messageInput.addEventListener('input', handleInput);
        messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); messageForm.requestSubmit(); } });
        fileInput.addEventListener('change', handleFileSelect);
        newChatBtn.addEventListener('click', startNewChat);
        searchInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
        chatHistory.addEventListener('click', handleHistoryActions);
        menuToggleBtn.addEventListener('click', () => { sidebar.classList.toggle('visible'); sidebarOverlay.classList.toggle('visible'); });
        sidebarOverlay.addEventListener('click', closeSidebarMobile);
        
        loadConversations();
        startNewChat();
    };
    
    // Ponto de entrada da aplicação
    initializeAuth();
});