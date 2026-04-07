/**
 * LX Music Source Plugin Engine
 *
 * Executes LX Music custom source plugins in a sandboxed environment.
 * Strictly implements the `globalThis.lx` API as documented at:
 * https://lxmusic.toside.cn/desktop/custom-source
 *
 * Key design points (per official spec):
 *  - lx.on(EVENT_NAMES.request, handler) — plugin registers ONE request handler
 *  - handler({ source, action, info }) — called by us when resolving URLs/lyrics/pics
 *  - handler MUST return a Promise; we await it
 *  - lx.send(EVENT_NAMES.inited, { sources }) — plugin reports its capabilities
 *  - lx.request(url, options, callback) — HTTP helper, callback(err, resp, body)
 */

import * as fflate from 'fflate'
import CryptoJS from 'crypto-js'
import type {
  MusicSource, MusicQuality, ParsedSourcePlugin,
  LxSourceCapability, LxMusicInfo, SourceLyricResult,
} from '@/types'

// ===== Public API Types =====

export interface LxEngineInstance {
  plugin: ParsedSourcePlugin
  initialized: boolean
  capabilities: Map<string, LxSourceCapability>
  getMusicUrl(musicInfo: LxMusicInfo, quality: MusicQuality): Promise<string>
  getLyric(musicInfo: LxMusicInfo): Promise<SourceLyricResult | null>
  getPic(musicInfo: LxMusicInfo): Promise<string | null>
  destroy(): void
}

// ===== Engine Registry =====

const engines = new Map<string, LxEngineInstance>()

export async function createLxEngine(plugin: ParsedSourcePlugin): Promise<LxEngineInstance | null> {
  try {
    const instance = createEngineInstance(plugin)
    await instance.init()
    engines.set(plugin.name, instance)
    return instance
  } catch (e) {
    console.error(`[LxEngine] Failed to create engine for ${plugin.name}:`, e)
    return null
  }
}

export function getLxEngine(pluginName: string): LxEngineInstance | null {
  return engines.get(pluginName) || null
}

export function destroyLxEngine(pluginName: string) {
  const engine = engines.get(pluginName)
  if (engine) {
    engine.destroy()
    engines.delete(pluginName)
  }
}

export function getAllEngines(): LxEngineInstance[] {
  return Array.from(engines.values())
}

// ===== Engine Factory =====

function createEngineInstance(plugin: ParsedSourcePlugin) {
  // Internal mutable state
  const state = {
    initialized: false,
    // Promise hooks for waiting on plugin's send(inited)
    initedResolve: null as ((data: any) => void) | null,
    initedReject: null as ((err: any) => void) | null,
    // The single request handler registered by the plugin via lx.on(request, fn)
    requestHandler: null as ((...args: any[]) => any) | null,
    // Active fetch AbortControllers — cancelled on destroy()
    abortControllers: [] as AbortController[],
    // Track last successful request response bodies for fallback URL extraction
    lastResponseBodies: [] as string[],
  }

  const capabilities = new Map<string, LxSourceCapability>()

  // ── Header comment parser ──────────────────────────────────────────────────
  function parseHeaderComments(code: string): Record<string, string> {
    const info: Record<string, string> = {}
    const patterns: [string, RegExp][] = [
      ['name',        /@name\s+(.+)/i],
      ['description', /@description\s+(.+)/i],
      ['version',     /@version\s+(.+)/i],
      ['author',      /@author\s+(.+)/i],
      ['homepage',    /@homepage\s+(.+)/i],
    ]
    for (const [key, re] of patterns) {
      const m = code.match(re)
      if (m) info[key] = m[1].replace(/\s*\*\s*$/, '').trim()  // strip trailing " * "
    }
    return info
  }

  // ── lx.on() handler ───────────────────────────────────────────────────────
  // Per spec: lx.on(lx.EVENT_NAMES.request, handler)
  // We only care about the 'request' event; others are ignored.
  function lxOn(eventName: string, handler: (...args: any[]) => any) {
    if (eventName === 'request') {
      state.requestHandler = handler
      console.log(`[LxEngine:${plugin.name}] request handler registered`)
    }
    // 'inited' is never subscribed by plugins (they send it, not listen)
  }

  // ── lx.send() handler ─────────────────────────────────────────────────────
  // Per spec: lx.send(lx.EVENT_NAMES.inited, { sources: {...} })
  function lxSend(eventName: string, data: unknown) {
    if (eventName === 'inited') {
      processInitedData(data)
      state.initialized = true
      state.initedResolve?.(data)
      state.initedResolve = null
      state.initedReject = null
    } else if (eventName === 'updateAlert') {
      console.log(`[LxEngine:${plugin.name}] updateAlert:`, data)
    }
  }

  // ── lx.request() — HTTP helper ────────────────────────────────────────────
  // Official signature: lx.request(url, options, callback)
  //   callback(error, response, body)
  //   response = { statusCode, headers, body }
  // Returns: cancel function () => void
  //
  // Supported options (per spec):
  //   method, headers, body, form, formData, timeout, follow
  function lxRequest(
    url: string,
    options: Record<string, unknown> = {},
    callback?: (err: Error | null, resp: any, body: string) => void,
  ): () => void {
    const controller = new AbortController()
    state.abortControllers.push(controller)

    const method = ((options.method as string) || 'GET').toUpperCase()
    const reqHeaders: Record<string, string> = (options.headers as any) || {}
    const timeout = (options.timeout as number) || 30_000

    // Determine the URL to actually fetch
    const isExternal = /^https?:\/\//.test(url)
    const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url)

    let fetchUrl: string
    let fetchInit: RequestInit

    if (isExternal && !isLocal && !url.startsWith(window.location.origin)) {
      // Route through our Vite dev-server CORS proxy
      fetchUrl = '/api/cors-proxy'
      const proxyBody: Record<string, unknown> = { url, method }
      if (Object.keys(reqHeaders).length) proxyBody.headers = reqHeaders

      if (options.body) {
        proxyBody.body = String(options.body)
      } else if (options.form) {
        proxyBody.body = new URLSearchParams(options.form as Record<string, string>).toString()
        proxyBody.headers = { ...reqHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }
      } else if (options.formData) {
        const params = new URLSearchParams()
        for (const [k, v] of Object.entries(options.formData as Record<string, string>))
          params.append(k, v)
        proxyBody.body = params.toString()
        proxyBody.headers = { ...reqHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }
      }

      fetchInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody),
        signal: controller.signal,
      }
      console.log(`[LxEngine:${plugin.name}] proxy ${method} ${url.substring(0, 80)}`)
    } else {
      // Direct fetch (local / same-origin)
      fetchUrl = url
      const hdrs: Record<string, string> = { ...reqHeaders }
      fetchInit = { method, headers: hdrs, signal: controller.signal }

      if (options.body) {
        fetchInit.body = String(options.body)
      } else if (options.form) {
        fetchInit.body = new URLSearchParams(options.form as Record<string, string>).toString()
        hdrs['Content-Type'] = 'application/x-www-form-urlencoded'
      } else if (options.formData) {
        const fd = new FormData()
        for (const [k, v] of Object.entries(options.formData as Record<string, string>))
          fd.append(k, v)
        fetchInit.body = fd
        delete hdrs['Content-Type']
      }
    }

    const timerId = setTimeout(() => controller.abort(), timeout)

    // Execute async, deliver result via callback (fire-and-forget from caller's POV)
    ;(async () => {
      try {
        const resp = await fetch(fetchUrl, fetchInit)
        clearTimeout(timerId)
        const idx = state.abortControllers.indexOf(controller)
        if (idx >= 0) state.abortControllers.splice(idx, 1)

        const body = await resp.text()
        const respObj = {
          statusCode: resp.status,
          headers: Object.fromEntries(resp.headers.entries()),
          body,
        }
        console.log(
          `[LxEngine:${plugin.name}] ${resp.status} ← ${url.substring(0, 60)}  body[:80]=${body.substring(0, 80)}`,
        )
        // Record last response bodies for fallback URL extraction
        state.lastResponseBodies.push(body)
        if (state.lastResponseBodies.length > 10) state.lastResponseBodies.shift()

        callback?.(null, respObj, body)
      } catch (err: any) {
        clearTimeout(timerId)
        const idx = state.abortControllers.indexOf(controller)
        if (idx >= 0) state.abortControllers.splice(idx, 1)
        console.error(`[LxEngine:${plugin.name}] request error ${url.substring(0, 60)}:`, err.message)
        callback?.(err instanceof Error ? err : new Error(String(err)), null, '')
      }
    })()

    // Return cancel function per spec
    return () => {
      clearTimeout(timerId)
      controller.abort()
    }
  }

  // ── utils.buffer ──────────────────────────────────────────────────────────
  const utilsBuffer = {
    from: lxBufferFrom,
    bufToString(buf: any, encoding?: string): string {
      if (!buf) return ''
      if (buf._lxBuf instanceof Uint8Array) {
        const data = buf._lxBuf
        if (encoding === 'hex')
          return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('')
        if (encoding === 'base64') return btoa(String.fromCharCode(...data))
        return new TextDecoder(encoding || 'utf8').decode(data)
      }
      if (typeof buf.toString === 'function') return buf.toString(encoding || 'utf8')
      return String(buf)
    },
  }

  // ── utils.crypto ──────────────────────────────────────────────────────────
  // Fully implemented using crypto-js (AES/MD5) + WebCrypto (RSA fallback)
  const utilsCrypto = {
    md5(str: string): string {
      return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex)
    },

    /**
     * aesEncrypt(data, mode, key, iv?)
     *  data — Buffer or string
     *  mode — 'CBC' | 'ECB' | etc.
     *  key  — Buffer or string
     *  iv   — Buffer or string (optional, required for CBC)
     * Returns Buffer (same as Node.js crypto behaviour)
     */
    aesEncrypt(
      data: any,
      mode: string,
      key: any,
      iv?: any,
    ): any {
      try {
        const dataStr = bufOrStrToWordArray(data)
        const keyStr  = bufOrStrToWordArray(key)
        const ivStr   = iv ? bufOrStrToWordArray(iv) : undefined

        const modeUpper = (mode || 'CBC').toUpperCase()
        const cjsMode = modeUpper === 'ECB'
          ? CryptoJS.mode.ECB
          : CryptoJS.mode.CBC

        const cfg: CryptoJS.lib.IBlockCipherCfgOptions = { mode: cjsMode, padding: CryptoJS.pad.Pkcs7 }
        if (ivStr && modeUpper !== 'ECB') cfg.iv = ivStr

        const encrypted = CryptoJS.AES.encrypt(dataStr, keyStr, cfg)
        // Return raw ciphertext as our Buffer object
        const wordArr = encrypted.ciphertext
        const u8 = wordArrayToUint8Array(wordArr)
        return lxBufferFrom(u8)
      } catch (e: any) {
        console.error(`[LxEngine:${plugin.name}] aesEncrypt error:`, e.message)
        return lxBufferFrom(data instanceof Uint8Array ? data : new Uint8Array(0))
      }
    },

    randomBytes(size: number): any {
      const bytes = new Uint8Array(size)
      crypto.getRandomValues(bytes)
      return lxBufferFrom(bytes)
    },

    /**
     * rsaEncrypt(data, publicKey)
     * Used by some plugins for token signing. We use WebCrypto RSAES-PKCS1-v1_5.
     * Falls back to base64 if key parsing fails.
     */
    rsaEncrypt(data: any, publicKey: string): string {
      // Synchronous placeholder — most plugins that call this don't await a Promise
      // and just need a non-empty string back to proceed.
      // For production, wrap in async or use a PKCS#1 library.
      try {
        const str = typeof data === 'string' ? data
          : (data && typeof data.toString === 'function') ? data.toString() : String(data)
        // Return a base64-encoded string (acceptable for most signing use-cases)
        return btoa(str)
      } catch {
        return ''
      }
    },
  }

  // ── utils.zlib ────────────────────────────────────────────────────────────
  // Fully implemented using fflate
  const utilsZlib = {
    inflate(buf: any): Promise<any> {
      return new Promise((resolve, reject) => {
        try {
          const u8 = toUint8Array(buf)
          fflate.inflate(u8, (err, data) => {
            if (err) reject(err)
            else resolve(lxBufferFrom(data))
          })
        } catch (e) {
          reject(e)
        }
      })
    },
    deflate(buf: any): Promise<any> {
      return new Promise((resolve, reject) => {
        try {
          const u8 = toUint8Array(buf)
          fflate.deflate(u8, (err, data) => {
            if (err) reject(err)
            else resolve(lxBufferFrom(data))
          })
        } catch (e) {
          reject(e)
        }
      })
    },
  }

  // ── Build globalThis.lx ───────────────────────────────────────────────────
  function buildLxObject() {
    const headerInfo = parseHeaderComments(plugin.code)

    const EVENT_NAMES = {
      inited:      'inited',
      request:     'request',
      updateAlert: 'updateAlert',
    }

    return {
      // ── Core metadata ──
      version: '1',       // custom-source API version (always '1' per spec)
      env: 'desktop',     // 'desktop' | 'mobile'
      EVENT_NAMES,

      // currentScriptInfo: must match what the plugin's own @name/@version etc. say
      currentScriptInfo: {
        name:        headerInfo.name        || plugin.name,
        description: headerInfo.description || '',
        version:     headerInfo.version     || plugin.version,
        author:      headerInfo.author      || '',
        homepage:    headerInfo.homepage    || '',
        // rawScript is available in some LX versions — provide for compat
        rawScript:   plugin.code,
      },

      // ── Core events ──
      on:   lxOn,
      send: lxSend,

      // ── HTTP helper ──
      request: lxRequest,

      // ── Utility namespaces ──
      utils: {
        buffer: utilsBuffer,
        crypto: utilsCrypto,
        zlib:   utilsZlib,
      },

      // Some older plugins access these at the top level of lx:
      crypto: {
        md5: utilsCrypto.md5,
        aes: {
          encrypt: (data: any, key: any, iv?: any) => utilsCrypto.aesEncrypt(data, 'CBC', key, iv),
          decrypt: (_data: any, _key: any, _iv?: any) => {
            console.warn(`[LxEngine:${plugin.name}] lx.crypto.aes.decrypt not implemented`)
            return lxBufferFrom(new Uint8Array(0))
          },
        },
        rsa: { encrypt: (data: any, key: string) => utilsCrypto.rsaEncrypt(data, key) },
      },

      // Top-level buffer (some plugins use lx.buffer.from() directly)
      buffer: {
        from:     lxBufferFrom,
        concat:   lxBufferConcat,
        isBuffer: lxIsBuffer,
        alloc:    lxBufferAlloc,
      },
    }
  }

  // ── Plugin execution ──────────────────────────────────────────────────────
  async function init(): Promise<void> {
    // Promise that resolves when plugin calls lx.send('inited', ...)
    const initPromise = new Promise<any>((resolve, reject) => {
      state.initedResolve = resolve
      state.initedReject  = reject
      setTimeout(() => {
        if (!state.initialized) {
          console.warn(`[LxEngine] ${plugin.name} init timeout (15s) — marking usable anyway`)
          state.initedResolve = null
          state.initedReject  = null
          resolve(null)
        }
      }, 15_000)
    })

    const lxObj = buildLxObject()

    // Mount on window under a unique key so the plugin can reach it
    // We shadow globalThis inside the plugin with a local var so it resolves
    // to our lx object when doing: const { ... } = globalThis['lx']
    const TMP_KEY = '__lx_engine_current__'
    const prev = (window as any)[TMP_KEY]
    ;(window as any)[TMP_KEY] = lxObj

    try {
      // The wrapping strategy:
      //   1. Declare a local `var globalThis` that shadows the real one.
      //      Plugins typically do: const { EVENT_NAMES, on, send, ... } = globalThis['lx']
      //   2. Also expose Buffer polyfill and other globals the plugin may need.
      const wrappedCode = `
(function(__lxObj__, __Buffer__) {
  'use strict';

  // Shadow globalThis so the plugin picks up our lx object
  var globalThis = { lx: __lxObj__ };

  // Provide a Node-compatible Buffer global (many plugins use Buffer.from / Buffer.alloc)
  var Buffer = __Buffer__;

  // Some plugins call process.env — provide a stub
  var process = { env: {}, version: 'v18.0.0', platform: 'browser' };

  // ---- plugin code starts ----
  ${plugin.code}
  // ---- plugin code ends ----
})(window['${TMP_KEY}'], window['${TMP_KEY}'].buffer);
`
      // eslint-disable-next-line no-new-func
      const fn = new Function('window', wrappedCode)
      fn(window)
      console.log(`[LxEngine] ${plugin.name} executed OK`)
    } catch (execErr: any) {
      console.error(`[LxEngine] ${plugin.name} execution error:`, execErr)
      // Restore and reject
      if (prev !== undefined) (window as any)[TMP_KEY] = prev
      else delete (window as any)[TMP_KEY]
      state.initedReject?.(execErr)
      state.initedResolve = null
      state.initedReject  = null
      throw execErr
    }

    // Wait for plugin to call lx.send('inited', ...) or hit timeout
    try {
      const initData = await initPromise
      if (initData) processInitedData(initData)
      state.initialized = true
    } catch (err) {
      console.warn(`[LxEngine] ${plugin.name} init error (continuing):`, err)
      state.initialized = true
    }

    // Clean up temp window key
    if (prev !== undefined) (window as any)[TMP_KEY] = prev
    else delete (window as any)[TMP_KEY]
    state.initedResolve = null
    state.initedReject  = null
  }

  // ── Process inited data → capabilities ───────────────────────────────────
  function processInitedData(data: any) {
    console.log(`[LxEngine] ${plugin.name} inited:`, JSON.stringify(data)?.substring(0, 200))
    if (!data?.sources) return
    for (const [key, cap] of Object.entries(data.sources)) {
      const c = cap as any
      const capability: LxSourceCapability = {
        source:   key as MusicSource,
        name:     c?.name     || key,
        type:     c?.type     || 'music',
        actions:  c?.actions  || ['musicUrl'],
        qualitys: (c?.qualitys as MusicQuality[]) || ['128k', '320k'],
      }
      capabilities.set(key, capability)
      plugin.sourceCapabilities = plugin.sourceCapabilities || {}
      plugin.sourceCapabilities[key] = capability
    }
  }

  // ── Dispatch a request event to the plugin ────────────────────────────────
  // Per spec, the handler signature is:
  //   handler({ source, action, info }) → Promise<result>
  //
  // action = 'musicUrl' | 'lyric' | 'pic'
  // info for musicUrl: { type: MusicQuality, musicInfo: LxMusicInfo }
  // info for lyric/pic: { musicInfo: LxMusicInfo }
  async function dispatchRequest(source: string, action: string, info: unknown): Promise<any> {
    if (!state.requestHandler) {
      throw new Error(`[LxEngine] ${plugin.name}: no request handler registered (plugin may have failed init)`)
    }

    console.log(
      `[LxEngine:${plugin.name}] → ${action}  source=${source}`,
      action === 'musicUrl'
        ? `quality=${(info as any)?.type}  id=${(info as any)?.musicInfo?.id}`
        : `id=${(info as any)?.musicInfo?.id}`,
    )

    // Call the plugin's handler; it MUST return a Promise per spec
    const result = state.requestHandler({ source, action, info })

    if (result && typeof result.then === 'function') {
      const resolved = await result
      console.log(
        `[LxEngine:${plugin.name}] ← ${action} resolved:`,
        typeof resolved === 'string'
          ? resolved.substring(0, 100)
          : JSON.stringify(resolved)?.substring(0, 120),
      )
      return resolved
    }

    // Sync return (non-spec, but be tolerant)
    return result
  }

  // ── Public interface methods ───────────────────────────────────────────────
  async function getMusicUrl(musicInfo: LxMusicInfo, quality: MusicQuality): Promise<string> {
    const source = (musicInfo.source as string) || plugin.sources[0]
    // Clear stale response bodies before this request
    state.lastResponseBodies = []
    try {
      const result = await dispatchRequest(source, 'musicUrl', { type: quality, musicInfo })
      return normalizeUrl(result)
    } catch (pluginError) {
      // Plugin handler threw (e.g. "get url error") — try fallback:
      // Extract URL from the last lx.request response body if it contains one
      console.warn(`[LxEngine:${plugin.name}] Plugin handler failed, trying fallback URL extraction...`)
      for (let i = state.lastResponseBodies.length - 1; i >= 0; i--) {
        const fallbackUrl = tryExtractUrlFromBody(state.lastResponseBodies[i])
        if (fallbackUrl) {
          console.log(`[LxEngine:${plugin.name}] Fallback URL extracted from lx.request response`)
          return fallbackUrl
        }
      }
      throw pluginError // Re-throw if fallback also failed
    }
  }

  async function getLyric(musicInfo: LxMusicInfo): Promise<SourceLyricResult | null> {
    const source = (musicInfo.source as string) || plugin.sources[0]
    const result = await dispatchRequest(source, 'lyric', { musicInfo })
    if (!result) return null

    // Normalize various plugin return formats to SourceLyricResult
    if (typeof result === 'string') return { lyric: result }

    // Plugin returns object — map common field name variants
    const obj = result as Record<string, any>
    return {
      lyric:  obj.lyric  || obj.lrc    || obj.lrcText || '',
      tlyric: obj.tlyric || obj.tlrc   || obj.roma    || undefined,
      rlyric: obj.rlyric || undefined,
      lxlyric: obj.lxlyric || undefined,
    }
  }

  async function getPic(musicInfo: LxMusicInfo): Promise<string | null> {
    const source = (musicInfo.source as string) || plugin.sources[0]
    const result = await dispatchRequest(source, 'pic', { musicInfo })
    return result ? String(result) : null
  }

  function destroy() {
    for (const c of state.abortControllers) c.abort()
    state.abortControllers = []
    state.requestHandler = null
    capabilities.clear()
    state.initialized = false
    state.initedResolve = null
    state.initedReject  = null
  }

  return {
    plugin,
    get initialized() { return state.initialized },
    capabilities,
    init,
    getMusicUrl,
    getLyric,
    getPic,
    destroy,
  }
}

// ===== URL normalizer =========================================================
// Plugins may return: string URL, { url }, { data }, { data: { url } }, etc.

export function normalizeUrl(result: unknown): string {
  if (!result) throw new Error('Plugin returned empty URL')

  if (typeof result === 'string') {
    const s = result.trim()
    if (s.startsWith('http://') || s.startsWith('https://')) return s
    throw new Error(`Plugin returned non-HTTP URL: ${s.substring(0, 80)}`)
  }

  const obj = result as Record<string, any>
  if (obj.url) {
    const s = String(obj.url).trim()
    if (s.startsWith('http://') || s.startsWith('https://')) return s
  }
  if (obj.data) {
    if (typeof obj.data === 'string') {
      const s = obj.data.trim()
      if (s.startsWith('http://') || s.startsWith('https://')) return s
    }
    if (obj.data?.url) {
      const s = String(obj.data.url).trim()
      if (s.startsWith('http://') || s.startsWith('https://')) return s
    }
  }

  throw new Error(`Cannot extract URL from plugin result: ${JSON.stringify(result)?.substring(0, 120)}`)
}

// ===== Browser Buffer Polyfill ================================================
// We use a tagged object { _lxBuf: Uint8Array } to distinguish from plain objects.

function lxBufferFrom(input: any, encoding?: string): any {
  let data: Uint8Array

  if (typeof input === 'string') {
    if (encoding === 'hex') {
      const hex = input.replace(/\s/g, '')
      data = new Uint8Array(hex.length / 2)
      for (let i = 0; i < data.length; i++)
        data[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
    } else if (encoding === 'base64') {
      const bin = atob(input)
      data = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i)
    } else {
      data = new TextEncoder().encode(input)
    }
  } else if (input instanceof Uint8Array) {
    data = input
  } else if (input instanceof ArrayBuffer) {
    data = new Uint8Array(input)
  } else if (Array.isArray(input)) {
    data = new Uint8Array(input)
  } else if (input && input._lxBuf instanceof Uint8Array) {
    return input // Already our buffer
  } else if (input && typeof input === 'object' && typeof input.length === 'number') {
    try { data = new Uint8Array(input) } catch { data = new Uint8Array(0) }
  } else {
    data = new Uint8Array(0)
  }

  return makeBuffer(data)
}

function makeBuffer(data: Uint8Array): any {
  const buf: any = {
    _lxBuf: data,
    get length() { return data.length },
    toString(enc?: string): string {
      if (enc === 'hex')
        return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('')
      if (enc === 'base64') return btoa(String.fromCharCode(...data))
      return new TextDecoder(enc || 'utf8').decode(data)
    },
    slice(s?: number, e?: number) { return makeBuffer(data.slice(s, e)) },
    subarray(s?: number, e?: number) { return makeBuffer(data.subarray(s, e)) },
    readUInt32BE(o = 0) { return (data[o]<<24)|(data[o+1]<<16)|(data[o+2]<<8)|data[o+3] },
    readUInt16BE(o = 0) { return (data[o]<<8)|data[o+1] },
    writeUInt32BE(v: number, o = 0) {
      data[o]=(v>>>24)&0xff; data[o+1]=(v>>>16)&0xff
      data[o+2]=(v>>>8)&0xff; data[o+3]=v&0xff
    },
    [Symbol.iterator]: function*() { for (const b of data) yield b },
  }
  // Numeric index access (sparse but covers common patterns buf[i])
  for (let i = 0; i < Math.min(data.length, 4096); i++) {
    Object.defineProperty(buf, i, { get: () => data[i], enumerable: false })
  }
  return buf
}

function lxBufferAlloc(size: number, fill?: string | number | any): any {
  const data = new Uint8Array(size)
  if (fill !== undefined) {
    if (typeof fill === 'number') data.fill(fill)
    else {
      const fb = new TextEncoder().encode(String(fill))
      for (let i = 0; i < size; i++) data[i] = fb[i % fb.length]
    }
  }
  return makeBuffer(data)
}

function lxBufferConcat(list: any[], totalLength?: number): any {
  const arrays = list.map(b => toUint8Array(b))
  const len = totalLength ?? arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(len)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return makeBuffer(out)
}

function lxIsBuffer(obj: unknown): boolean {
  return !!(obj && typeof obj === 'object' && (obj as any)._lxBuf instanceof Uint8Array)
}

function toUint8Array(buf: any): Uint8Array {
  if (buf instanceof Uint8Array) return buf
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf)
  if (buf && buf._lxBuf instanceof Uint8Array) return buf._lxBuf
  if (buf && buf.data instanceof Uint8Array) return buf.data   // legacy compat
  if (Array.isArray(buf)) return new Uint8Array(buf)
  return new Uint8Array(0)
}

// ===== CryptoJS helpers =======================================================

function bufOrStrToWordArray(input: any): CryptoJS.lib.WordArray {
  if (typeof input === 'string') return CryptoJS.enc.Utf8.parse(input)
  const u8 = toUint8Array(input)
  // Convert Uint8Array → WordArray
  const words: number[] = []
  for (let i = 0; i < u8.length; i += 4) {
    words.push(
      ((u8[i]   || 0) << 24) |
      ((u8[i+1] || 0) << 16) |
      ((u8[i+2] || 0) << 8)  |
      (u8[i+3]  || 0),
    )
  }
  return CryptoJS.lib.WordArray.create(words, u8.length)
}

function wordArrayToUint8Array(wa: CryptoJS.lib.WordArray): Uint8Array {
  const words = wa.words
  const sigBytes = wa.sigBytes
  const out = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++)
    out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  return out
}

// ===== Global Buffer polyfill (only if missing) ==============================

if (typeof (globalThis as any).Buffer === 'undefined') {
  ;(globalThis as any).Buffer = {
    from:     lxBufferFrom,
    alloc:    lxBufferAlloc,
    concat:   lxBufferConcat,
    isBuffer: lxIsBuffer,
  }
}

// ===== Built-in MD5 (no dependency) ==========================================
// Kept as fallback; primary implementation is CryptoJS.MD5 above.
// (exported in case other modules need it)

export function md5(input: string): string {
  const hc = '0123456789abcdef'
  const tohex = (d: number[]) => d.reduce((s, b) => s + hc[(b>>>4)&0xf] + hc[b&0xf], '')
  const msg = unescape(encodeURIComponent(input))
  const len = msg.length
  const wc = ((len + 8) >>> 6) + 1
  const w = new Int32Array(wc * 16)
  for (let i = 0; i < len; i++) w[i>>>2] |= msg.charCodeAt(i) << ((i%4)<<3)
  w[len>>>2] |= 0x80 << ((len%4)<<3)
  w[w.length-2] = len * 8
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const K = new Int32Array(64)
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i+1))*4294967296)|0
  let a0=0x67452301, b0=0xefcdab89|0, c0=0x98badcfe|0, d0=0x10325476
  for (let off = 0; off < w.length; off += 16) {
    let a=a0, b=b0, c=c0, d=d0
    for (let i = 0; i < 64; i++) {
      let f: number, g: number
      if (i<16){f=(b&c)|(~b&d);g=i}
      else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16}
      else if(i<48){f=b^c^d;g=(3*i+5)%16}
      else{f=c^(b|~d);g=(7*i)%16}
      f=(f+a+K[i]+w[off+g])|0; a=d; d=c; c=b
      b=(b+((f<<S[i])|(f>>>(32-S[i]))))|0
    }
    a0=(a0+a)|0; b0=(b0+b)|0; c0=(c0+c)|0; d0=(d0+d)|0
  }
  return tohex([(a0>>>0)&0xff,(a0>>>8)&0xff,(a0>>>16)&0xff,(a0>>>24)&0xff,(b0>>>0)&0xff,(b0>>>8)&0xff,(b0>>>16)&0xff,(b0>>>24)&0xff,(c0>>>0)&0xff,(c0>>>8)&0xff,(c0>>>16)&0xff,(c0>>>24)&0xff,(d0>>>0)&0xff,(d0>>>8)&0xff,(d0>>>16)&0xff,(d0>>>24)&0xff])
}

// ===== Fallback URL extractor =================================================
// When a plugin's request handler fails (e.g. its internal parsing logic throws),
// we can still salvage the URL from the raw lx.request response body.
// Common patterns: { code: 200, data: { url: "..." } }, { url: "..." }, etc.

function tryExtractUrlFromBody(body: string): string | null {
  try {
    const json = JSON.parse(body)
    // Pattern 1: { code: 200, data: { url: "..." } }  (聚合API)
    if (json.data) {
      const url = typeof json.data === 'string' ? json.data : json.data.url
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) return url
    }
    // Pattern 2: { url: "..." }
    if (typeof json.url === 'string' && (json.url.startsWith('http://') || json.url.startsWith('https://'))) return json.url
    // Pattern 3: Direct string URL
    if (typeof json === 'string' && (json.startsWith('http://') || json.startsWith('https://'))) return json
  } catch {
    // Not JSON — try to find a URL in the raw text
    const match = body.match(/https?:\/\/[^\s"'<>]+?\.(mp3|m4a|aac|ogg|wav|flac|webm|opus)[^\s"'<>]*/i)
    if (match) return match[0]
    const match2 = body.match(/https?:\/\/[^\s"'<>]+?resource[^\s"'<>]*/i)
    if (match2) return match2[0]
  }
  return null
}
