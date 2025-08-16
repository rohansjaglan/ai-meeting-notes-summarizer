const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Disable web security for speech API
      cache: false, // Disable cache
      partition: isDev ? 'persist:dev' : 'persist:main', // Use separate partition for dev
      allowRunningInsecureContent: true, // Allow insecure content in dev
      experimentalFeatures: true // Enable experimental features
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // Clear cache in development
  if (isDev) {
    const session = mainWindow.webContents.session;
    session.clearCache();
    session.clearStorageData();
    session.clearAuthCache();
    session.clearHostResolverCache();
  }

  // Load the app - Force dev server in development
  const startUrl = 'http://localhost:3000'; // Always use dev server for now
  
  // Add cache-busting parameter
  const finalUrl = `${startUrl}?t=${Date.now()}&nocache=true`;
  
  console.log('Loading URL:', finalUrl);
  console.log('isDev:', isDev);
  mainWindow.loadURL(finalUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
      // Force reload to ensure fresh content
      setTimeout(() => {
        mainWindow.webContents.reloadIgnoringCache();
      }, 1000);
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize/maximize
  mainWindow.on('minimize', () => {
    // Optional: Handle minimize event
  });

  mainWindow.on('maximize', () => {
    // Optional: Handle maximize event
  });
}

// Add command line switches for permissions
if (isDev) {
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-running-insecure-content');
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://localhost:3000');
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  
  // Register global shortcuts for development
  if (isDev) {
    // Force refresh with Ctrl+Shift+R
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      if (mainWindow) {
        mainWindow.webContents.reloadIgnoringCache();
      }
    });
    
    // Regular refresh with F5
    globalShortcut.register('F5', () => {
      if (mainWindow) {
        mainWindow.webContents.reload();
      }
    });
  }
});

app.on('window-all-closed', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
  });
  
  // Handle permission requests
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    if (permission === 'microphone' || permission === 'media') {
      // Always allow microphone access in development
      console.log('Granting microphone permission');
      callback(true);
    } else {
      callback(false);
    }
  });
  
  // Also handle permission check requests
  contents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    console.log('Permission check:', permission, 'from:', requestingOrigin);
    if (permission === 'microphone' || permission === 'media') {
      return true;
    }
    return false;
  });
});

// IPC handlers for future use
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('platform-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.version
  };
});