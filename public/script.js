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
    const recordAudioBtn = document.getElementById('record-audio-btn');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');

    // --- ESTADO DA APLICAÇÃO ---
    let currentChatId = null;
    let conversations = {};
    let isRecording = false;
    let speechRecognition = null;
    let stagedAttachment = null;

    // --- LÓGICA DE ÁUDIO (SPEECH-TO-TEXT) ---
    const setupSpeechRecognition = () => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognitionAPI) {
            speechRecognition = new SpeechRecognitionAPI();
            speechRecognition.continuous = true;
            speechRecognition.lang = 'pt-BR';
            speechRecognition.interimResults = true;
            speechRecognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    finalTranscript += event.results[i][0].transcript;
                }
                messageInput.value = finalTranscript;
                handleInput();
            };
            speechRecognition.onend = () => {
                isRecording = false;
                recordAudioBtn.classList.remove('recording');
            };
        } else {
            recordAudioBtn.style.display = 'none'; // Esconde o botão se a API não for suportada
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            speechRecognition.stop();
        } else {
            if (!speechRecognition) return;
            try {
                speechRecognition.start();
                isRecording = true;
                recordAudioBtn.classList.add('recording');
            } catch (e) {
                console.error("Erro ao iniciar gravação:", e);
                isRecording = false;
                recordAudioBtn.classList.remove('recording');
            }
        }
    };

    // --- LÓGICA DE ANEXOS ---
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
            alert('Funcionalidade completa para outros tipos de arquivo não implementada. Apenas imagens podem ser pré-visualizadas.');
        }
        fileInput.value = '';
    };

    const renderAttachmentPreview = () => {
        attachmentPreview.innerHTML = '';
        attachmentPreview.style.display = 'none';
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
            const buttons = createActionButtons(() => content);
            wrapper.appendChild(buttons);
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
        sendButton.disabled = true;
        const aiMessageContent = addMessageToUI({ role: 'ia' });
        const cursor = document.createElement('span');
        cursor.classList.add('blinking-cursor');
        aiMessageContent.appendChild(cursor);
        try {
            const messagesForApi = conversations[currentChatId].messages.map(m => ({ role: m.role, content: m.content }));
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesForApi })
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
            aiMessageContent.textContent = `Desculpe, ocorreu um erro: ${error.message}`;
            cursor.remove();
        } finally {
            sendButton.disabled = false;
        }
    };

    // --- LÓGICA DE HISTÓRICO ---
    const saveConversations = () => localStorage.setItem('chatConversations', JSON.stringify(conversations));
    const loadConversations = () => {
        const saved = localStorage.getItem('chatConversations');
        if (saved) conversations = JSON.parse(saved);
    };
    
    const renderChatHistory = (filter = '') => {
        chatHistory.innerHTML = '';
        const chatIds = Object.keys(conversations);
        const pinnedChats = chatIds.filter(id => conversations[id].isPinned && conversations[id].title.toLowerCase().includes(filter.toLowerCase()));
        const unpinnedChats = chatIds.filter(id => !conversations[id].isPinned && conversations[id].title.toLowerCase().includes(filter.toLowerCase()));
        const createHistoryItem = (id) => {
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
        pinnedChats.sort((a, b) => b.localeCompare(a)).forEach(createHistoryItem);
        unpinnedChats.sort((a, b) => b.localeCompare(a)).forEach(createHistoryItem);
    };

    const toggleContextMenu = (chatId, target) => {
        document.querySelector('.history-context-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'history-context-menu visible';
        const pinText = conversations[chatId].isPinned ? 'Desafixar' : 'Fixar';
        menu.innerHTML = `<button class="context-menu-btn" data-action="pin" data-id="${chatId}">${pinText}</button><button class="context-menu-btn delete" data-action="delete" data-id="${chatId}">Excluir</button>`;
        target.parentElement.appendChild(menu);
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    };

    const handleHistoryActions = (e) => {
        if (e.target.matches('.context-menu-btn')) {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;
            if (action === 'pin') pinChat(id);
            if (action === 'delete') deleteChat(id);
            document.querySelector('.history-context-menu')?.remove();
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
    
    const startNewChat = () => { currentChatId = null; chatWindow.innerHTML = ''; welcomeView.style.display = 'flex'; chatWindow.style.display = 'none'; messageInput.value = ''; stagedAttachment = null; renderAttachmentPreview(); renderChatHistory(); sidebar.classList.remove('visible'); };
    
    const loadChat = (chatId) => {
        if (!conversations[chatId]) return;
        currentChatId = chatId;
        chatWindow.innerHTML = '';
        welcomeView.style.display = 'none';
        chatWindow.style.display = 'block';
        conversations[chatId].messages.forEach(addMessageToUI);
        renderChatHistory();
        sidebar.classList.remove('visible');
    };

    const handleInput = () => { messageInput.style.height = 'auto'; messageInput.style.height = (messageInput.scrollHeight) + 'px'; };

    // --- EVENT LISTENERS ---
    messageForm.addEventListener('submit', handleFormSubmit);
    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); messageForm.requestSubmit(); } });
    recordAudioBtn.addEventListener('click', toggleRecording);
    fileInput.addEventListener('change', handleFileSelect);
    newChatBtn.addEventListener('click', startNewChat);
    searchInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
    chatHistory.addEventListener('click', handleHistoryActions);
    menuToggleBtn.addEventListener('click', () => sidebar.classList.toggle('visible'));

    // --- INICIALIZAÇÃO ---
    const initializeApp = () => { loadConversations(); renderChatHistory(); setupSpeechRecognition(); startNewChat(); };
    initializeApp();
});