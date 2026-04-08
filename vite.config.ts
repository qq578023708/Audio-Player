import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { createCipheriv, createDecipheriv, createHash } from 'crypto'

/**
 * Custom Vite plugin: Generic CORS proxy for LX Music source plugins.
 * Routes: POST /api/cors-proxy with body { url, method?, headers?, body? }
 *         GET  /api/cors-proxy?url=<encoded_url>
 * The server fetches the target URL server-side and returns the raw response,
 * completely bypassing browser CORS restrictions.
 */
/**
 * Custom Vite plugin: Kuwo Board API proxy with wbdCrypto encryption.
 * Routes: GET /api/kw-board/list — fetch board list
 *         GET /api/kw-board/songs?id=XX&page=1&limit=100 — fetch songs for a board
 * This handles the AES-128-ECB encryption that the kuwo.cn wbd API requires,
 * which cannot be done in the browser without crypto libraries.
 */
function kuwoBoardPlugin(): Plugin {
  const AES_KEY = Buffer.from([112, 87, 39, 61, 199, 250, 41, 191, 57, 68, 45, 114, 221, 94, 140, 228])
  const APP_ID = 'y67sprxhhpws'

  function aesEncrypt(data: Buffer): string {
    const cipher = createCipheriv('aes-128-ecb', AES_KEY, null)
    return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64')
  }

  function aesDecrypt(data: Buffer): string {
    const decipher = createDecipheriv('aes-128-ecb', AES_KEY, null)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString()
  }

  function createSign(data: string, time: number): string {
    return createHash('md5').update(`${APP_ID}${data}${time}`).digest('hex').toUpperCase()
  }

  function buildParam(jsonData: any): string {
    const data = Buffer.from(JSON.stringify(jsonData))
    const time = Date.now()
    const encodeData = aesEncrypt(data)
    const sign = createSign(encodeData, time)
    return `data=${encodeURIComponent(encodeData)}&time=${time}&appId=${APP_ID}&sign=${sign}`
  }

  function decodeData(base64Result: string): any {
    const data = Buffer.from(decodeURIComponent(base64Result), 'base64')
    return JSON.parse(aesDecrypt(data))
  }

  return {
    name: 'kuwo-board',
    configureServer(server) {
      server.middlewares.use('/api/kw-board', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost')
          const path = url.pathname.replace('/api/kw-board', '')

          if (path === '/list') {
            // Fetch board list from qukudata
            const fetchResp = await fetch('http://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2')
            const body = await fetchResp.json() as { child?: Array<{ source: string; sourceid: string | number; name: string; pic?: string }> }
            const boards: any[] = []
            if (body.child) {
              for (const board of body.child) {
                if (board.source === '1') {
                  boards.push({
                    id: 'kw__' + board.sourceid,
                    name: board.name,
                    bangid: String(board.sourceid),
                    pic: board.pic || '',
                  })
                }
              }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ code: 0, data: boards }))
          } else if (path === '/songs') {
            // Fetch songs for a specific board (encrypted API)
            const boardId = url.searchParams.get('id') || '93'
            const page = parseInt(url.searchParams.get('page') || '1')
            const limit = parseInt(url.searchParams.get('limit') || '100')

            const requestBody = {
              uid: '', devId: '', sFrom: 'kuwo_sdk', user_type: 'AP',
              carSource: 'kwplayercar_ar_6.0.1.0_apk_keluze.apk',
              id: boardId, pn: page - 1, rn: limit,
            }
            const requestUrl = `https://wbd.kuwo.cn/api/bd/bang/bang_info?${buildParam(requestBody)}`
            const fetchResp = await fetch(requestUrl)
            const respText = await fetchResp.text()
            const rawData = decodeData(respText)

            if (rawData.code !== 200 || !rawData.data?.musiclist) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ code: rawData.code || -1, data: { musiclist: [], total: 0 } }))
              return
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(rawData))
          } else {
            res.writeHead(404)
            res.end('Not found')
          }
        } catch (err: any) {
          console.error('[Kuwo-Board] Error:', err.message)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

function kuwoMobilePlugin(): Plugin {
  return {
    name: 'kuwo-mobile-proxy',
    configureServer(server) {
      server.middlewares.use('/api/kuwo-m', async (req, res, _next) => {
        const targetBase = 'http://m.kuwo.cn'
        const targetUrl = targetBase + (req.url || '')
        try {
          const resp = await fetch(targetUrl, {
            headers: {
              'Referer': 'http://m.kuwo.cn/',
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
            },
          })
          const body = await resp.text()
          res.writeHead(resp.status, {
            'Content-Type': resp.headers.get('content-type') || 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(body)
        } catch (err: any) {
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end('Proxy error: ' + err.message)
        }
      })
    },
  }
}

function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/cors-proxy', async (req, res) => {
        try {
          let targetUrl: string | null = null
          let method = 'GET'
          let reqHeaders: Record<string, string> = {}
          let reqBody: string | undefined

          if (req.method === 'GET') {
            const url = new URL(req.url || '/', 'http://localhost')
            targetUrl = url.searchParams.get('url')
          } else if (req.method === 'POST') {
            // Read request body
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk)
            const rawBody = Buffer.concat(chunks).toString('utf8')
            try {
              const parsed = JSON.parse(rawBody)
              targetUrl = parsed.url
              method = parsed.method || 'GET'
              reqHeaders = parsed.headers || {}
              reqBody = parsed.body
            } catch {
              targetUrl = rawBody.trim()
            }
          }

          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Missing target url' }))
            return
          }

          const parsed = new URL(targetUrl)

          // Build fetch options
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...reqHeaders,
          }
          // Remove host header (will be set automatically)
          delete fetchHeaders['host']
          delete fetchHeaders['Host']

          const fetchOpts: any = {
            method,
            headers: fetchHeaders,
            redirect: 'follow',
          }
          if (reqBody && method !== 'GET' && method !== 'HEAD') {
            fetchOpts.body = reqBody
          }

          console.log(`[CORS-Proxy] ${method} ${parsed.hostname}${parsed.pathname.substring(0, 60)}`)

          const fetchResp = await fetch(targetUrl, fetchOpts)

          // Forward status and headers
          const respHeaders: Record<string, string> = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          }
          fetchResp.headers.forEach((value, key) => {
            // Skip hop-by-hop headers
            if (!['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'].includes(key)) {
              respHeaders[key] = value
            }
          })

          const respBody = await fetchResp.text()
          res.writeHead(fetchResp.status, respHeaders)
          res.end(respBody)

          console.log(`[CORS-Proxy] ${fetchResp.status} for ${parsed.hostname}${parsed.pathname.substring(0, 40)}`)
        } catch (err: any) {
          console.error('[CORS-Proxy] Error:', err.message)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [kuwoBoardPlugin(), kuwoMobilePlugin(), corsProxyPlugin(), vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Kuwo chart API
      '/api/kuwo': {
        target: 'https://kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kuwo/, ''),
        headers: {
          'Referer': 'https://kuwo.cn/',
          'Origin': 'https://kuwo.cn',
        },
      },
      // Kuwo wapi (songList tags) — different domain
      '/api/kuwo-tag': {
        target: 'http://wapi.kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kuwo-tag/, ''),
      },
      // Kuwo mobile API (lyrics, no auth needed) — handled via custom plugin below
      // Kugou chart API (mobilecdnbj is used by LX Music)
      '/api/kugou': {
        target: 'http://mobilecdnbj.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kugou/, ''),
      },
      // QQ Music chart API (u.y.qq.com for musicu.fcg)
      '/api/qqmusic': {
        target: 'https://u.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qqmusic/, ''),
        headers: {
          'Referer': 'https://y.qq.com/',
        },
      },
      // Netease chart API
      '/api/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netease/, ''),
        headers: {
          'Referer': 'https://music.163.com/',
          'Origin': 'https://music.163.com',
        },
      },
      // Migu chart API
      '/api/migu': {
        target: 'https://pd.musicapp.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/migu/, ''),
      },
      // Search API proxies
      '/api/search-kw': {
        target: 'https://search.kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search-kw/, ''),
      },
      '/api/search-kg': {
        target: 'https://mobilecdn.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search-kg/, ''),
      },
      '/api/search-wy': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search-wy/, ''),
        headers: {
          'Referer': 'https://music.163.com/',
          'Origin': 'https://music.163.com',
        },
      },
      '/api/search-tx': {
        target: 'https://c.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search-tx/, ''),
        headers: {
          'Referer': 'https://y.qq.com/',
        },
      },
      '/api/search-mg': {
        target: 'https://pd.musicapp.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search-mg/, ''),
      },
      // Kuwo song URL resolution
      '/api/kw-url': {
        target: 'https://www.kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kw-url/, ''),
        headers: {
          'Referer': 'https://www.kuwo.cn/',
          'Origin': 'https://www.kuwo.cn',
          'Cookie': 'kw_token=',
        },
      },
    },
  },
})
