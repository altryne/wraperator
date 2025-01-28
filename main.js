const { app, BrowserWindow, session, ipcMain, Notification, Tray, Menu } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
let mainWindow;

// In-memory store
const store = {
  conversations: [],        // array of conversation objects  
};
let tray = null;

// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('wraperator', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('wraperator')
}

// Handle the URL when app is already running (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleIncomingUrl(url);
});

app.whenReady().then(() => {
  createTray();
});

function createTray() {
  // Create the tray icon
  tray = new Tray(path.join(__dirname, "assets", "icon_white@2x.png"));

  // Build an initial context menu
  updateTrayMenu();

  // Optional: Set a tooltip (mouse hover text)
  tray.setToolTip("My Operator Tasks");

}

// Set up a simple Express server to expose conversation data to Raycast
const localApp = express();
localApp.use(bodyParser.json()); // for parsing JSON bodies in POST

// Endpoint to get the current conversation list
localApp.get('/conversations', (req, res) => {
  return res.json({
    conversations: store.conversations
  });
});

localApp.listen(3001, () => {
  console.log('[Express] Listening on http://localhost:3001');
});


// Function to handle incoming URLs
function handleIncomingUrl(url) {
  if (!url || !mainWindow) return;
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'wraperator:') {
      const task = decodeURIComponent(urlObj.searchParams.get('task') || '');
      const conversationId = decodeURIComponent(urlObj.searchParams.get('conversationId') || '');
      if (conversationId) {
        if (mainWindow) {
          mainWindow.loadURL(`https://operator.chatgpt.com/c/${conversationId}`);
          mainWindow.focus();
        }
      }
      if (task) {
        console.log('Received task:', task);
        mainWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              // Wait for page to be fully loaded
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Click "New conversation" button
              const newButton = document.querySelector('button[aria-label="New conversation"]');
              if (newButton) newButton.click();
              
              // Wait for input to be available
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Find and update the input using React's synthetic events
              const input = document.getElementById('home-page-composer');
              if (input) {
                // Create a new InputEvent
                const inputEvent = new InputEvent('input', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'insertText',
                  data: "${task}",
                  isComposing: false
                });

                // Set the value and dispatch events
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                nativeInputValueSetter.call(input, "${task}");
                
                input.dispatchEvent(inputEvent);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Wait a bit for React to process the events
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Find and click the send button
                const sendButton = document.querySelector('button:has(path[d^="M11.2929 5.29289C11.6834 4.90237"])');
                if (sendButton && !sendButton.disabled) {
                  sendButton.click();
                } else {
                  console.log('Send button not ready or disabled');
                }

                // Wait for the message to be sent and check its role
                await new Promise(resolve => setTimeout(resolve, 500));
                const messages = document.querySelectorAll('[data-message]');
                const lastMessage = messages[messages.length - 1];
                if (lastMessage) {
                  const messageData = JSON.parse(lastMessage.getAttribute('data-message'));
                  if (messageData.author?.role !== 'user') {
                    // Only show notification for non-user messages
                    window.electron.showNotification({
                      title: 'New Message',
                      body: messageData.content?.parts?.join(' ') || 'New message received'
                    });
                  }
                }
              }
            } catch (error) {
              console.error('Error handling incoming URL:', error);
            }
          })();
        `);
      }
    }
  } catch (error) {
    console.error('Error parsing incoming URL:', error);
  }
}

// Define icon path
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

// Set app name and metadata
app.setName('Wraperator');
if (process.platform === 'darwin') {
  app.dock.setIcon(ICON_PATH);
}

// Configure notifications
if (process.platform === 'darwin') {
  app.setAppUserModelId('com.wraperator.app');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Wraperator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // Ensure node integration is disabled for security
      webSecurity: true, // Ensure web security is enabled
      // Add these to help with website loading
      allowRunningInsecureContent: false,
      webviewTag: false
    },
    icon: ICON_PATH
  });

  // Add DevTools for debugging only in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window focus events
  mainWindow.on('focus', () => {
    console.log('Window focused');
    mainWindow.webContents.send('window-focus-change', true);
  });

  mainWindow.on('blur', () => {
    console.log('Window lost focus');
    mainWindow.webContents.send('window-focus-change', false);
  });

  // Log navigation events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Started loading...');
  });

  

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Finished loading');
    mainWindow.webContents.executeJavaScript(`
      if (window.__electronPreloadInit__) {
        try {
          window.__electronPreloadInit__.initializeAPI();
          console.log('API initialization completed');
        } catch (error) {
          console.error('API initialization failed:', error);
        }
      }
    `);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  // Set Chrome user agent using alternate syntax
  mainWindow.webContents.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

  // Modify the CSP to be less restrictive and allow blob URLs and workers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' blob: data:; " +
          "script-src * 'unsafe-inline' 'unsafe-eval' blob: data:; " +
          "connect-src * 'unsafe-inline' blob: data:; " +
          "img-src * data: blob: 'unsafe-inline'; " +
          "frame-src *; " +
          "style-src * 'unsafe-inline'; " +
          "worker-src * blob: data:;"
        ]
      }
    });
  });

  // Load your website
  mainWindow.loadURL('https://operator.chatgpt.com').catch(err => {
    console.error('Load URL error:', err);
  });

  // Set up permission handling
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    console.log('Permission requested:', { permission, url });
    
    // List of allowed permissions for operator.chatgpt.com
    if (url.startsWith('https://operator.chatgpt.com')) {
      const allowedPermissions = [
        'notifications',
        'clipboard-read',
        'clipboard-write',
        'media'
      ];
      
      const isAllowed = allowedPermissions.includes(permission);
      console.log(`Permission ${permission} ${isAllowed ? 'allowed' : 'denied'}`);
      callback(isAllowed);
    } else {
      console.log(`Permission ${permission} denied for non-matching URL`);
      callback(false);
    }
  });

  // Add this to monitor permission check results
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    console.log('Permission check:', { permission, requestingOrigin });
    return true;  // Allow all permission checks for now
  });

  // Add this to debug notification creation
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('Console message:', { level, message });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateTrayMenu() {
  const menuTemplate = [];
  if (store.active_conversations.length > 0) {
    tray.setTitle(`Active Agents: ${store.active_conversations.length}`);
  }else{
    tray.setTitle(``);
  }

  menuTemplate.push({
    label: "Wraperator",
    type: "normal",
    click: () => {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  menuTemplate.push({ type: "separator" });

  let unread_count = 0;

  // Create a menu item for each active task
  for (const task of store.conversations.slice(0, 10)) {
    const messageTime = task.last_communication_message.create_time;
    const viewedTime = task.last_viewed_by_user_timestamp;
    const isUnread = (messageTime > viewedTime);
    const isActive = task.status === "Active";
    if (isUnread) {
      unread_count++;
    }
    menuTemplate.push({
      label: isActive ? `[${task.status}] ${task.title || task.id}` : isUnread ? `${task.title || task.id}` : task.title,
      type: "normal",
      icon: path.join(__dirname, "assets", isUnread ? "icon_unread@2x.png" : isActive ? "icon_active_32.png" : "icon_white@2x.png"),
      click: () => {
        console.log(`You clicked on task: ${task}`);
        // Optionally bring your main window to front or do something
        if (mainWindow) {
          mainWindow.loadURL(`https://operator.chatgpt.com/c/${task.id}`);
          mainWindow.focus();
        }
      }
    });
  }

  if (unread_count > 0) {
    tray.setImage(path.join(__dirname, "assets", "icon_unread@2x.png"));
  }else{
    tray.setImage(path.join(__dirname, "assets", "icon_white@2x.png"));
  }

  // A separator, then a "Quit" menu item at the bottom
  menuTemplate.push({ type: "separator" });
  menuTemplate.push({
    label: "Quit",
    type: "normal",
    click: () => {
      app.quit();
    }
  });

  // Build and set the context menu
  const trayMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(trayMenu);
}

// Listen for updated conversation lists from preload.js
ipcMain.on('update-conversation-list', (event, list_recent) => {
  console.log('[Main] Received conversation list:', list_recent);
  
  store.conversations = list_recent;
  store.active_conversations = list_recent.filter(conversation => conversation.status === 'Active');
  store.waiting_for_user_conversations = list_recent.filter(conversation => conversation.status === 'WaitingForUser');
  console.log('[Main] Updated conversation list, count =', store.conversations.length, store.active_conversations.length, store.waiting_for_user_conversations.length);
  updateTrayMenu();
});

ipcMain.on('show-notification', (event, { title, options }) => {
  console.log('Main process received notification request:', { 
    title, 
    options,
    time: new Date().toISOString()
  });

  const notificationOptions = {
    title,
    body: options.body || '',
    silent: options.silent ?? false,
    hasReply: options.hasReplyBox ?? false, // Enable reply input if hasReplyBox is true
    replyPlaceholder: 'Type your response...' // Placeholder text for the reply input
  };

  // Add actions if available
  if (options.actions) {
    notificationOptions.actions = options.actions;
  }

  const notification = new Notification(notificationOptions);

  notification.on('click', () => {
    console.log('Notification clicked:', {
      title,
      url: options.data?.url,
      time: new Date().toISOString()
    });
    if (options.data?.url && mainWindow) {
      mainWindow.loadURL(options.data.url);
      mainWindow.focus();
    }
  });

  // Handle reply input
  notification.on('reply', (event, reply) => {
    console.log('Notification reply received:', {
      title,
      reply,
      time: new Date().toISOString()
    });
    if (mainWindow) {
      // Send the reply to the renderer process
      mainWindow.webContents.send('notification-reply', {
        messageId: options.data?.messageId,
        reply
      });
      mainWindow.focus();
    }
  });

  // Handle action button clicks
  notification.on('action', (event, index) => {
    console.log('Notification action clicked:', {
      title,
      actionIndex: index,
      url: options.data?.url,
      time: new Date().toISOString()
    });
    if (options.data?.url && mainWindow) {
      mainWindow.loadURL(options.data.url);
      mainWindow.focus();
    }
  });

  notification.on('show', () => {
    console.log('Notification shown:', {
      title,
      time: new Date().toISOString()
    });
  });

  notification.on('close', () => {
    console.log('Notification closed:', {
      title,
      time: new Date().toISOString()
    });
  });

  notification.on('failed', (event, error) => {
    console.error('Notification failed:', {
      title,
      error,
      time: new Date().toISOString()
    });
  });

  try {
    notification.show();
    console.log('Notification.show() called successfully');
  } catch (error) {
    console.error('Error showing notification:', error);
  }
});

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

