const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onMediaControl: (callback) => {
    ipcRenderer.on('media-control', (_event, action) => callback(action))
  },
  platform: process.platform,
  isElectron: true
})
