const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Media controls
  onMediaControl: (callback) => {
    ipcRenderer.on('media-control', (_event, action) => callback(action))
  },

  // Platform info
  platform: process.platform,
  isElectron: true,

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized) => callback(isMaximized))
  },

  // Open DevTools in separate window
  openDevTools: () => ipcRenderer.invoke('open-devtools-window'),

  // Update settings (for tray behavior)
  updateSettings: (settings) => ipcRenderer.send('update-settings', settings),

  // API proxy for production (when no Vite dev server)
  // Intercepts /api/ requests and routes them through the main process
  // CRITICAL: We return a plain data object here, NOT a Response object.
  // Preload scripts run in a limited context where global Response may be absent
  // or non-functional. The renderer (useElectron.ts) will construct the Response.
  proxyFetch: async (url, options = {}) => {
    const reqHeaders = {}
    if (options.headers) {
      const h = options.headers
      if (h instanceof Headers) {
        h.forEach((v, k) => { reqHeaders[k.toLowerCase()] = v })
      } else if (typeof h === 'object') {
        for (const [k, v] of Object.entries(h)) {
          if (v && typeof v === 'string') {
            reqHeaders[k.toLowerCase()] = v
          }
        }
      }
    }

    // Request body — send as plain string for IPC
    let bodyStr = null
    if (options.body && options.method !== 'GET' && options.method !== 'HEAD') {
      bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    }

    // Invoke IPC — main process returns body as base64 string
    const result = await ipcRenderer.invoke('proxy-fetch', url, options.method || 'GET', reqHeaders, bodyStr)

    // Return raw data — let the renderer construct the Response
    return result  // { status, body (base64), contentType }
  },
})

