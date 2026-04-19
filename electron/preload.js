const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Estadísticas
  getEstadisticas: () => ipcRenderer.invoke('db:getEstadisticas'),

  // Animales
  getAnimales: (filtros) => ipcRenderer.invoke('db:getAnimales', filtros),
  getAnimal: (id) => ipcRenderer.invoke('db:getAnimal', id),
  getAnimalByCrotal: (crotal) => ipcRenderer.invoke('db:getAnimalByCrotal', crotal),
  getAnimalByNombre: (nombre) => ipcRenderer.invoke('db:getAnimalByNombre', nombre),
  createAnimal: (data) => ipcRenderer.invoke('db:createAnimal', data),
  updateAnimal: (id, data) => ipcRenderer.invoke('db:updateAnimal', id, data),
  deleteAnimal: (id) => ipcRenderer.invoke('db:deleteAnimal', id),
  getDescendencia: (id) => ipcRenderer.invoke('db:getDescendencia', id),
  getRazas: () => ipcRenderer.invoke('db:getRazas'),
  getAnimalesParaSelector: () => ipcRenderer.invoke('db:getAnimalesParaSelector'),

  // Historial médico
  getHistorialMedico: (animalId) => ipcRenderer.invoke('db:getHistorialMedico', animalId),
  createRegistroMedico: (data) => ipcRenderer.invoke('db:createRegistroMedico', data),
  deleteRegistroMedico: (id) => ipcRenderer.invoke('db:deleteRegistroMedico', id),

  // Gestaciones
  getGestaciones: (animalId) => ipcRenderer.invoke('db:getGestaciones', animalId),
  createGestacion: (data) => ipcRenderer.invoke('db:createGestacion', data),
  updateGestacion: (id, data) => ipcRenderer.invoke('db:updateGestacion', id, data),
  deleteGestacion: (id) => ipcRenderer.invoke('db:deleteGestacion', id),
  getAllGestacionesCalendario: () => ipcRenderer.invoke('db:getAllGestacionesCalendario'),
  getAnimalesPorGranja: () => ipcRenderer.invoke('db:getAnimalesPorGranja'),
  getAnimalesConEstadoHasta: () => ipcRenderer.invoke('db:getAnimalesConEstadoHasta'),

  // Granjas
  getGranjas: () => ipcRenderer.invoke('db:getGranjas'),
  getGranja: (id) => ipcRenderer.invoke('db:getGranja', id),
  createGranja: (data) => ipcRenderer.invoke('db:createGranja', data),
  updateGranja: (id, data) => ipcRenderer.invoke('db:updateGranja', id, data),
  deleteGranja: (id) => ipcRenderer.invoke('db:deleteGranja', id),
})
