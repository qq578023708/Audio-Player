const { app, BrowserWindow, globalShortcut } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const VITE_DEV_SERVER_URL = 'http://localhost:5173'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 400,
    minHeight: 500,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f0f14',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Set AppUserModelId for Windows taskbar
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.audioflow.player')
  }

  // Media controls (global)
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('media-control', 'togglePlay')
  })
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('media-control', 'playNext')
  })
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('media-control', 'playPrev')
  })

  // Load content
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
  }

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  // Handle new window requests
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
