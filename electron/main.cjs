const { app, BrowserWindow, globalShortcut, Menu, ipcMain, net } = require('electron')
const path = require('path')
const { URL } = require('url')
const fs = require('fs')

const isDev = !app.isPackaged
const VITE_DEV_SERVER_URL = 'http://localhost:5173'

// ====== File-based logging for packaged builds ======
// In packaged mode, console.log goes nowhere visible, so we write to a log file.
let logStream = null
if (!isDev) {
  const logDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  const logFile = path.join(logDir, `main-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  logStream = fs.createWriteStream(logFile, { flags: 'a' })
  // Override console.log/error to also write to file
  const origLog = console.log
  const origError = console.error
  console.log = (...args) => {
    origLog(...args)
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    logStream.write(`[LOG] ${new Date().toISOString()} ${line}\n`)
  }
  console.error = (...args) => {
    origError(...args)
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    logStream.write(`[ERR] ${new Date().toISOString()} ${line}\n`)
  }
  // Also log unhandled exceptions
  process.on('uncaughtException', (err) => {
    logStream.write(`[UNCAUGHT] ${new Date().toISOString()} ${err.stack}\n`)
  })
}

// ====== API Proxy Rules (mirrors vite.config.ts proxy config) ======
const PROXY_RULES = [
  { prefix: '/api/kuwo',      target: 'https://kuwo.cn',               extraHeaders: { Referer: 'https://kuwo.cn/', Origin: 'https://kuwo.cn' } },
  { prefix: '/api/kuwo-tag',  target: 'http://wapi.kuwo.cn' },
  { prefix: '/api/kuwo-m',    target: 'http://m.kuwo.cn',              extraHeaders: { Referer: 'http://m.kuwo.cn/' } },
  { prefix: '/api/kugou',     target: 'http://mobilecdnbj.kugou.com' },
  { prefix: '/api/qqmusic',   target: 'https://u.y.qq.com',            extraHeaders: { Referer: 'https://y.qq.com/' } },
  { prefix: '/api/netease',   target: 'https://music.163.com',         extraHeaders: { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' } },
  { prefix: '/api/migu',      target: 'https://pd.musicapp.migu.cn' },
  { prefix: '/api/search-kw', target: 'https://search.kuwo.cn' },
  { prefix: '/api/search-kg', target: 'https://mobilecdn.kugou.com' },
  { prefix: '/api/search-wy', target: 'https://music.163.com',         extraHeaders: { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' } },
  { prefix: '/api/search-tx', target: 'https://c.y.qq.com',            extraHeaders: { Referer: 'https://y.qq.com/' } },
  { prefix: '/api/search-mg', target: 'https://pd.musicapp.migu.cn' },
  { prefix: '/api/kw-url',    target: 'https://www.kuwo.cn',           extraHeaders: { Referer: 'https://www.kuwo.cn/', Origin: 'https://www.kuwo.cn/', Cookie: 'kw_token=' } },
]

// kuwo-board is handled with special crypto logic on the server side
const KW_BOARD_AES_KEY = Buffer.from([112, 87, 39, 61, 199, 250, 41, 191, 57, 68, 45, 114, 221, 94, 140, 228])
const KW_BOARD_APP_ID = 'y67sprxhhpws'

function kwBoardAesEncrypt(data) {
  const crypto = require('crypto')
  const cipher = crypto.createCipheriv('aes-128-ecb', KW_BOARD_AES_KEY, null)
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64')
}

function kwBoardAesDecrypt(data) {
  const crypto = require('crypto')
  const decipher = crypto.createDecipheriv('aes-128-ecb', KW_BOARD_AES_KEY, null)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString()
}

function kwBoardCreateSign(data, time) {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(`${KW_BOARD_APP_ID}${data}${time}`).digest('hex').toUpperCase()
}

function kwBoardBuildParam(jsonData) {
  const data = Buffer.from(JSON.stringify(jsonData))
  const time = Date.now()
  const encodeData = kwBoardAesEncrypt(data)
  const sign = kwBoardCreateSign(encodeData, time)
  return `data=${encodeURIComponent(encodeData)}&time=${time}&appId=${KW_BOARD_APP_ID}&sign=${sign}`
}

function kwBoardDecodeData(base64Result) {
  const data = Buffer.from(decodeURIComponent(base64Result), 'base64')
  return JSON.parse(kwBoardAesDecrypt(data))
}

/**
 * Find matching proxy rule for a given request path.
 * Uses LONGEST prefix match to avoid ambiguity (e.g. /api/kuwo-m must not
 * match the shorter /api/kuwo prefix).
 */
function findProxyRule(requestPath) {
  let bestMatch = null
  let bestLen = 0
  for (const rule of PROXY_RULES) {
    if (requestPath.startsWith(rule.prefix) && rule.prefix.length > bestLen) {
      bestMatch = rule
      bestLen = rule.prefix.length
    }
  }
  return bestMatch
}

/**
 * Proxy an API request using Node.js net module (bypasses CORS).
 * Returns { status, headers, body, contentType } or throws on error.
 */
function proxyRequest(reqPath, method, headers, body) {
  console.log(`[proxy] Request: ${method} ${reqPath}`)
  return new Promise((resolve, reject) => {
    // Special handling for /api/kw-board
    if (reqPath.startsWith('/api/kw-board/list')) {
      // Fetch board list
      const req = net.request('http://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2')
      req.on('response', (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || 'application/json',
        }))
      })
      req.on('error', reject)
      req.end()
      return
    }

    if (reqPath.startsWith('/api/kw-board/songs')) {
      const url = new URL(reqPath, 'http://localhost')
      const boardId = url.searchParams.get('id') || '93'
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '100')
      console.log(`[proxy] kw-board/songs: boardId=${boardId}, page=${page}, limit=${limit}`)
      const requestBody = {
        uid: '', devId: '', sFrom: 'kuwo_sdk', user_type: 'AP',
        carSource: 'kwplayercar_ar_6.0.1.0_apk_keluze.apk',
        id: boardId, pn: page - 1, rn: limit,
      }
      const requestUrl = `https://wbd.kuwo.cn/api/bd/bang/bang_info?${kwBoardBuildParam(requestBody)}`
      console.log(`[proxy] kw-board URL: ${requestUrl.substring(0, 120)}...`)
      const req = net.request(requestUrl)
      req.on('response', (response) => {
        console.log(`[proxy] kw-board response status: ${response.statusCode}`)
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          try {
            // The API returns AES-128-ECB encrypted base64 data — must decrypt!
            const rawText = Buffer.concat(chunks).toString('utf-8')
            console.log(`[proxy] kw-board raw response length: ${rawText.length}, preview: ${rawText.substring(0, 80)}`)
            const decrypted = kwBoardDecodeData(rawText)
            console.log(`[proxy] kw-board decrypt OK, code: ${decrypted.code}, musiclist count: ${decrypted.data?.musiclist?.length || 0}`)
            resolve({
              status: 200,
              body: Buffer.from(JSON.stringify(decrypted), 'utf-8'),
              contentType: 'application/json',
            })
          } catch (decryptErr) {
            console.error('[kw-board/songs] Decrypt error:', decryptErr.message)
            console.error('[kw-board/songs] Raw response preview:', Buffer.concat(chunks).toString('utf-8').substring(0, 200))
            resolve({
              status: 502,
              body: Buffer.from(JSON.stringify({ code: -1, data: { musiclist: [], total: 0 } }), 'utf-8'),
              contentType: 'application/json',
            })
          }
        })
      })
      req.on('error', reject)
      req.end()
      return
    }

    // Special handling for /api/cors-proxy (generic CORS proxy)
    if (reqPath.startsWith('/api/cors-proxy')) {
      let targetUrl = null
      let corsMethod = method
      let customHeaders = {}
      if (corsMethod === 'GET') {
        const url = new URL(reqPath, 'http://localhost')
        targetUrl = url.searchParams.get('url')
      } else if (body) {
        try {
          const parsed = JSON.parse(body.toString())
          targetUrl = parsed.url
          corsMethod = parsed.method || corsMethod
          // CRITICAL: Extract custom headers from the proxy body
          // Plugins often set Referer, Cookie, etc. via lx.request headers
          if (parsed.headers && typeof parsed.headers === 'object') {
            customHeaders = parsed.headers
          }
        } catch { /* ignore */ }
      }
      if (!targetUrl) { reject(new Error('Missing target url')); return }

      const fetchHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      if (headers['content-type']) fetchHeaders['Content-Type'] = headers['content-type']
      // Forward custom headers from the proxy body (e.g. Referer, Cookie)
      for (const [k, v] of Object.entries(customHeaders)) {
        if (v && typeof v === 'string') {
          fetchHeaders[k] = v
        }
      }
      console.log(`[proxy] cors-proxy → ${corsMethod} ${targetUrl.substring(0, 100)}, headers: ${Object.keys(fetchHeaders).join(', ')}`)

      const req = net.request({ url: targetUrl, method: corsMethod })
      for (const [k, v] of Object.entries(fetchHeaders)) req.setHeader(k, v)
      req.on('response', (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || 'application/octet-stream',
        }))
      })
      req.on('error', reject)
      if (body && corsMethod !== 'GET' && corsMethod !== 'HEAD') req.write(body)
      req.end()
      return
    }

    // Standard proxy rule matching
    const rule = findProxyRule(reqPath)
    if (!rule) { reject(new Error('No proxy rule for ' + reqPath)); return }

    const backendPath = reqPath.replace(rule.prefix, '')
    const targetUrl = new URL(backendPath, rule.target)

    const reqHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    // Rule-level extra headers first (e.g. Referer for music platforms)
    if (rule.extraHeaders) Object.assign(reqHeaders, rule.extraHeaders)
    // Then forward renderer-sent headers (Content-Type, Accept, etc.)
    // Renderer headers can override rule-level ones if needed
    for (const [k, v] of Object.entries(headers)) {
      if (v && typeof v === 'string') {
        // Normalize header name: content-type → Content-Type
        const key = k === 'content-type' ? 'Content-Type' : k
        reqHeaders[key] = v
      }
    }

    const req = net.request({ url: targetUrl.toString(), method })
    for (const [k, v] of Object.entries(reqHeaders)) req.setHeader(k, v)

    req.on('response', (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks),
        contentType: response.headers['content-type'] || 'application/octet-stream',
      }))
    })
    req.on('error', reject)

    if (body && method !== 'GET' && method !== 'HEAD') req.write(body)
    req.end()
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0f0f14',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // NOTE: sandbox must be false — preload.cjs uses Buffer (from Node.js)
      // which is unavailable in sandboxed preload scripts.
      // contextIsolation: true still provides full security isolation.
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  // Remove default menu bar
  Menu.setApplicationMenu(null)

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Allow opening DevTools with F12 or Ctrl+Shift+I (works in both dev & production)
  globalShortcut.register('F12', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools()
    }
  })
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  // Log console messages from renderer for debugging (all levels in production for diagnostics)
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    if (isDev) {
      if (level >= 2) console.log(`[Renderer:${level}] ${message}`)
    } else {
      // In production, log everything for easier debugging
      const prefix = level === 0 ? 'log' : level === 1 ? 'info' : level === 2 ? 'warn' : 'error'
      console.log(`[Renderer:${prefix}] ${message}`)
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

  // Window control IPC handlers
  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window-close', () => mainWindow.close())
  ipcMain.handle('window-is-maximized', () => mainWindow.isMaximized())

  // Notify renderer when maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', false)
  })

  // API proxy IPC handler
  // NOTE: body must be a plain string (not ArrayBuffer) — contextBridge cannot serialize ArrayBuffer!
  // Request body: plain string (utf-8)
  // Response body: base64 string (decoded by preload with Buffer.from)
  ipcMain.handle('proxy-fetch', async (_event, reqPath, method, reqHeaders, bodyStr) => {
    console.log(`[ipc] proxy-fetch: ${method} ${reqPath}`)
    try {
      const body = bodyStr ? Buffer.from(bodyStr, 'utf-8') : null
      const result = await proxyRequest(reqPath, method || 'GET', reqHeaders || {}, body)
      console.log(`[ipc] proxy-fetch OK: status=${result.status}, bodyLen=${result.body.length}`)
      return {
        status: result.status,
        body: result.body.toString('base64'),
        contentType: result.contentType,
      }
    } catch (err) {
      console.error('[ipc] proxy-fetch ERROR:', err.message)
      console.error('[ipc] Stack:', err.stack)
      return {
        status: 502,
        body: Buffer.from(JSON.stringify({ error: err.message }), 'utf-8').toString('base64'),
        contentType: 'application/json',
      }
    }
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
