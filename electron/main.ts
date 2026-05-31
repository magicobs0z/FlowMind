import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createBrowserWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  })

  if (isDev) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    window.loadURL(frontendUrl)
    window.webContents.openDevTools()
  } else {
    window.loadFile(path.join(app.getAppPath(), 'frontend', 'index.html'))
  }

  window.once('ready-to-show', () => {
    window.show()
  })

  return window
}

app.whenReady().then(() => {
  const mainWindow = createBrowserWindow()

  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:get-platform', () => {
    return process.platform
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createBrowserWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
