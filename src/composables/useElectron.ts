/**
 * Detects Electron environment and patches global fetch to proxy
 * /api/ requests through the main process (bypassing CORS in production).
 * 
 * In development, the Vite dev server handles proxying.
 * In Electron production (file:// protocol), we route through IPC.
 */

interface ElectronAPI {
  isElectron: boolean
  proxyFetch: (url: string, options?: RequestInit) => Promise<{ status: number; body: string; contentType: string }>
  platform: string
  onMediaControl: (callback: (action: string) => void) => void
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/** True if running inside packaged Electron (file:// protocol, no Vite dev server) */
export function isElectronProduction(): boolean {
  return !!(window.electronAPI?.isElectron && window.location.protocol === 'file:')
}

/**
 * Monkey-patch global fetch to intercept /api/ requests in Electron production.
 * In dev mode (http://localhost), Vite proxy handles it — this is a no-op.
 * In production (file://), we route through IPC to main process.
 */
export function setupElectronFetchProxy(): void {
  if (!window.electronAPI?.isElectron) return
  // Only activate in production (file:// protocol). In dev mode, Vite proxy handles /api/.
  if (window.location.protocol !== 'file:') return

  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // Only intercept /api/ requests
    // In file:// protocol, "/api/xxx" resolves to "file:///api/xxx"
    // We need to extract the /api/ path from the full URL
    const apiPath = url.includes('/api/') ? url.substring(url.indexOf('/api/')) : null

    if (apiPath && apiPath.startsWith('/api/')) {
      console.log(`[Electron Proxy] Fetching: ${init?.method || 'GET'} ${apiPath}`)
      const result = await window.electronAPI!.proxyFetch(apiPath, init || {})
      if (!result) {
        console.error('[Electron Proxy] proxyFetch returned null/undefined')
        throw new Error('proxyFetch returned null/undefined')
      }
      const status = result.status || 200
      // Decode base64 body to Uint8Array in renderer (full Web APIs available here)
      const bodyBytes = Uint8Array.from(atob(result.body), c => c.charCodeAt(0))
      const response = new Response(bodyBytes, {
        status: status,
        statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
        headers: { 'Content-Type': result.contentType || 'application/json' },
      })
      console.log(`[Electron Proxy] Response: ${response.status} ${response.ok ? 'OK' : 'ERROR'}`)
      return response
    }

    // Pass through non-API requests
    return originalFetch(input, init)
  }

  console.log('[Electron] Fetch proxy active — /api/ requests routed through main process')
}
