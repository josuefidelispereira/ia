// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = messageForm.querySelector('button');

    // MUDANÇA CRUCIAL: A URL agora aponta para a nossa função na Cloudflare.
    // A Cloudflare automaticamente roteia uma requisição para /chat para o arquivo functions/chat.js
    const API_URL = '/chat';

    const addMessage = (sender, content) => {
        // ... (o restante desta função é exatamente igual ao exemplo anterior)
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', sender);

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        messageWrapper.appendChild(messageDiv);
        chatWindow.appendChild(messageWrapper);

        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return messageDiv;
    };
    
    const showLoadingIndicator = () => {
        const loadingMessage = addMessage('ia', '');
        loadingMessage.classList.add('loading');
        return loadingMessage;
    };

    const hideLoadingIndicator = (indicator) => {
        if (indicator) {
            indicator.parentElement.remove();
        }
    };

    messageForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        messageInput.disabled = true;
        sendButton.disabled = true;

        addMessage('user', userMessage);
        messageInput.value = '';
        const loadingIndicator = showLoadingIndicator();

        try {
            // O restante desta função também é idêntico
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });

            hideLoadingIndicator(loadingIndicator);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            addMessage('ia', data.reply);

        } catch (error) {
            hideLoadingIndicator(loadingIndicator);
            addMessage('ia', `Erro: ${error.message}`);
        } finally {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    });
});