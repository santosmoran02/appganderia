const { app, BrowserWindow, dialog, shell } = require('electron')
const path = require('path')
const https = require('https')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: 'GanadApp',
    show: false,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

function checkForUpdates() {
  const options = {
    hostname: 'api.github.com',
    path: '/repos/santosmoran02/appganderia/releases/latest',
    headers: { 'User-Agent': 'GanadApp' },
  }
  https.get(options, res => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => {
      try {
        const release = JSON.parse(data)
        const latest = release.tag_name?.replace(/^v/, '')
        const current = app.getVersion()
        if (latest && latest !== current) {
          dialog.showMessageBox({
            type: 'info',
            title: 'Nueva versión disponible',
            message: `Hay una nueva versión de GanadApp disponible: v${latest} (tienes la v${current}).`,
            detail: `Para actualizar:\n1. Descarga el nuevo instalador desde la página web.\n2. Ejecuta el instalador descargado (no es necesario desinstalar la versión actual).\n3. La nueva versión quedará instalada automáticamente.`,
            buttons: ['Ir a la página de descarga', 'Más tarde'],
          }).then(({ response }) => {
            if (response === 0) shell.openExternal('https://santosmoran02.github.io/appganderia/')
          })
        }
      } catch (_) {}
    })
  }).on('error', () => {})
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  if (!isDev) checkForUpdates()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

