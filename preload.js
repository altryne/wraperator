// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Track window focus state
let isWindowFocused = true;
// Shared Set to track processed messages across all interceptors
const processedMessages = new Set();

// Listen for notification replies from main process
ipcRenderer.on('notification-reply', (event, { messageId, reply }) => {
  console.log('Received notification reply:', { messageId, reply });
  
  // Find the textarea input
  const textarea = document.getElementById('home-page-composer');
  if (textarea) {
    // Create input event
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: reply,
      isComposing: false
    });

    // Set value and dispatch events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    nativeInputValueSetter.call(textarea, reply);
    textarea.dispatchEvent(inputEvent);
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    // Find and click the send button
    setTimeout(() => {
      const sendButton = document.querySelector('button:has(path[d^="M11.2929 5.29289C11.6834 4.90237"])');
      if (sendButton && !sendButton.disabled) {
        sendButton.click();
      }
    }, 100);
  }
});

ipcRenderer.on('window-focus-change', (event, focused) => {
  isWindowFocused = focused;
  console.log('Window focus state changed:', { isWindowFocused, time: new Date().toISOString() });
});

// Shared notification function
const sendNotificationToMain = (title, options) => {
  console.log('sendNotification called:', { 
    title, 
    options, 
    isWindowFocused,
    time: new Date().toISOString()
  });
  
  // Only send notification if window is not focused on the current conversation_id
  const incomingConversationId = options.conversation_id;
  const currentUserConversationId = window.location.pathname.split('/')[2];
  const isUserFocusedOnConversation = incomingConversationId == currentUserConversationId;
  
  if (!isWindowFocused || !isUserFocusedOnConversation) {
    console.log('Sending notification to main process:', { 
      title,
      time: new Date().toISOString()
    });

    // Add hasReplyBox for messages without action buttons
    // if (!options.actions && !options.data?.hasAction) {
    //   options.hasReplyBox = true;
    // }
    
    ipcRenderer.send('show-notification', { 
      title, 
      options
    });
  } else {
    console.log('Not sending notification');
    console.log('Is user focused on conversation:', isUserFocusedOnConversation);
    console.log('Is Window focused:', isWindowFocused);
  }
};

// Shared message handling function
const handleNewMessageInternal = (message, conversationId) => {
  if (!message || processedMessages.has(message.id)) {
    return;
  }

  processedMessages.add(message.id);
  const messageContent = message.content?.parts?.[0] || message.text || message.title;
  
  if (messageContent) {
    console.log('New message detected:', message, conversationId);

    // Prepare notification options
    const notificationOptions = {
      body: messageContent, // Set the full message as the body
      conversation_id: conversationId,
      silent: false,
      data: { 
        url: `https://operator.chatgpt.com/c/${conversationId}`,
        messageId: message.id,
        hasAction: !!message.button_type
      }
    };

    // If there's a button_type, add actions
    if (message.button_type) {
      notificationOptions.actions = [
        {
          type: 'button',
          text: `Open ${message.button_type}`,
        }
      ];
    }
    
    sendNotificationToMain(
      message.title ? message.title : 'Operator Update',
      notificationOptions
    );
  }
};

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: sendNotificationToMain,
  isWindowFocused: () => isWindowFocused,
  updateConversations: (conversations) => {
    console.log('Sending conversations to main process', conversations);
    ipcRenderer.send('update-conversation-list', conversations);
  },
  handleNewMessage: handleNewMessageInternal,
  hasProcessedMessage: (messageId) => processedMessages.has(messageId),
  addProcessedMessage: (messageId) => processedMessages.add(messageId)
});

// Inject the WebSocket interceptor into the renderer context
const wsInterceptorCode = () => {
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const socket = new OriginalWebSocket(url, protocols);
    
    if (url.includes('ConversationUpdateHub')) {
      socket.addEventListener('message', (event) => {
        try {
          const rawData = JSON.parse(event.data);
          if (rawData.type !== 'message' || !rawData.data) return;
          
          const data = JSON.parse(rawData.data);
          if (!data.message) return;
          console.log('Raw message data:', data);
          
          // Only process messages meant for all recipients and not from the user
          if (data.message.status === 'finished_successfully' && 
              data.message.recipient === 'all' && 
              data.message.author?.role !== 'user') {
            
            window.electronAPI.handleNewMessage(data.message, data.conversation_id);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          console.error('Message data:', event.data);
        }
      });
    }
    
    return socket;
  };
  
  Object.assign(window.WebSocket, OriginalWebSocket);
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  
  console.log('WebSocket interceptor set up for notifications');
};

// Add fetch override code
const fetchOverrideCode = () => {
  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const [resource] = args;
    const isListRecent = resource.toString().includes('list_recent');
    
    const response = await originalFetch.apply(this, args);

    // Only process list_recent responses
    if (isListRecent) {
      const cloned = response.clone();
      const contentType = cloned.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        cloned.json().then(jsonData => {
          const conversations = jsonData.conversations;
          for (const conversation of conversations) {
            const messageTime = conversation.last_communication_message.create_time;
            const viewedTime = conversation.last_viewed_by_user_timestamp;
            const isUnread = (messageTime > viewedTime);
            const isActive = conversation.status === "Active";
            conversation.isUnread = isUnread;
            conversation.isActive = isActive;
            const message = conversation.last_communication_message;
            if (message.status === 'finished_successfully' && 
              message.recipient === 'all' && 
              message.author?.role !== 'user' && 
              isUnread) {
              message.title = conversation.title;
              window.electronAPI.handleNewMessage(
                message, 
                conversation.id
              );
            }
          }
          
          try {
            window.electronAPI.updateConversations(conversations);
            console.log('[fetch override] conversations sent to main process');
          } catch (error) {
            console.error('[fetch override] Error sending conversations to main process:', error);
          }
        }).catch(error => {
          console.error('[fetch override] Error processing JSON:', error);
        });
      }
    }

    return response;
  };
};

// Expose a function to initialize both interceptors
contextBridge.exposeInMainWorld('__electronPreloadInit__', {
  initializeAPI: () => {
    console.log('initializeAPI called, setting up interceptors');
    
    // Inject WebSocket interceptor
    const wsScript = document.createElement('script');
    wsScript.textContent = `(${wsInterceptorCode.toString()})();`;
    document.head.appendChild(wsScript);
    
    // Inject fetch override
    const fetchScript = document.createElement('script');
    fetchScript.textContent = `(${fetchOverrideCode.toString()})();`;
    document.head.appendChild(fetchScript);
    
    console.log('WebSocket and fetch interceptors injected');
  }
});