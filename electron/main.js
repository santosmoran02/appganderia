const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

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

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: 'Hay una nueva versión de GanadApp. ¿Instalar ahora?',
    buttons: ['Instalar y reiniciar', 'Más tarde'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC handlers ----
const db = require('./database')

ipcMain.handle('db:getEstadisticas', () => db.getEstadisticas())
ipcMain.handle('db:getAnimales', (_, filtros) => db.getAnimales(filtros))
ipcMain.handle('db:getAnimal', (_, id) => db.getAnimal(id))
ipcMain.handle('db:getAnimalByCrotal', (_, crotal) => db.getAnimalByCrotal(crotal))
ipcMain.handle('db:getAnimalByNombre', (_, nombre) => db.getAnimalByNombre(nombre))
ipcMain.handle('db:createAnimal', (_, data) => db.createAnimal(data))
ipcMain.handle('db:updateAnimal', (_, id, data) => db.updateAnimal(id, data))
ipcMain.handle('db:deleteAnimal', (_, id) => db.deleteAnimal(id))
ipcMain.handle('db:getDescendencia', (_, id) => db.getDescendencia(id))
ipcMain.handle('db:getRazas', () => db.getRazas())
ipcMain.handle('db:getAnimalesParaSelector', () => db.getAnimalesParaSelector())
ipcMain.handle('db:getHistorialMedico', (_, animalId) => db.getHistorialMedico(animalId))
ipcMain.handle('db:createRegistroMedico', (_, data) => db.createRegistroMedico(data))
ipcMain.handle('db:deleteRegistroMedico', (_, id) => db.deleteRegistroMedico(id))
ipcMain.handle('db:getGestaciones', (_, animalId) => db.getGestaciones(animalId))
ipcMain.handle('db:createGestacion', (_, data) => db.createGestacion(data))
ipcMain.handle('db:updateGestacion', (_, id, data) => db.updateGestacion(id, data))
ipcMain.handle('db:deleteGestacion', (_, id) => db.deleteGestacion(id))
ipcMain.handle('db:getAllGestacionesCalendario', () => db.getAllGestacionesCalendario())
ipcMain.handle('db:getAnimalesPorGranja', () => db.getAnimalesPorGranja())
ipcMain.handle('db:getAnimalesConEstadoHasta', () => db.getAnimalesConEstadoHasta())

ipcMain.handle('db:getGranjas', () => db.getGranjas())
ipcMain.handle('db:getGranja', (_, id) => db.getGranja(id))
ipcMain.handle('db:createGranja', (_, data) => db.createGranja(data))
ipcMain.handle('db:updateGranja', (_, id, data) => db.updateGranja(id, data))
ipcMain.handle('db:deleteGranja', (_, id) => db.deleteGranja(id))
