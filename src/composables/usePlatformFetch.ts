/**
 * Platform-aware fetch wrapper
 * 
 * Handles different network scenarios:
 * 1. Web dev (localhost) - Use /api/ proxy via Vite
 * 2. Electron production (file://) - Use IPC proxy via main process
 * 3. Android/iOS (capacitor:// or http://localhost) - Use direct API calls with CORS proxy
 */

import { isElectronProduction } from './useElectron'

/** Detect if running in Capacitor mobile app */
export function isCapacitor(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

/** Detect if running in Android WebView */
export function isAndroid(): boolean {
  return isCapacitor() && (window as any).Capacitor.getPlatform() === 'android'
}

/** Detect if running in iOS WebView */
export function isIOS(): boolean {
  return isCapacitor() && (window as any).Capacitor.getPlatform() === 'ios'
}

/** Get the appropriate base URL for API requests */
function getApiBaseUrl(): string {
  if (isElectronProduction()) {
    // Electron production - use IPC proxy (handled by useElectron)
    return ''
  }
  
  if (isCapacitor()) {
    // Capacitor mobile - use direct API endpoints
    // We'll construct full URLs in the API functions
    return ''
  }
  
  // Web dev - use Vite proxy
  return ''
}

/** Platform-aware fetch that handles different environments */
export async function platformFetch(
  url: string, 
  options?: RequestInit,
  directUrl?: string // Full direct URL for mobile platforms
): Promise<Response> {
  // Electron production - use IPC proxy via useElectron's patched fetch
  if (isElectronProduction()) {
    return fetch(url, options)
  }
  
  // Capacitor mobile - use direct URL with CORS handling
  if (isCapacitor() && directUrl) {
    try {
      // Try direct fetch first
      const response = await fetch(directUrl, options)
      return response
    } catch (e) {
      console.warn(`[PlatformFetch] Direct fetch failed for ${directUrl}, trying CORS proxy...`, e)
      // Fall back to CORS proxy if available
      throw e
    }
  }
  
  // Web dev - use normal fetch (Vite proxy handles /api/)
  return fetch(url, options)
}

/** 
 * Get the actual URL to use for an API endpoint
 * This transforms /api/xxx paths to full URLs for mobile platforms
 */
export function resolveApiUrl(path: string, directUrl?: string): string {
  if (isCapacitor() && directUrl) {
    return directUrl
  }
  return path
}

/** Initialize platform-specific fetch handling */
export function setupPlatformFetch(): void {
  if (isCapacitor()) {
    console.log('[PlatformFetch] Capacitor detected - using direct API calls')
  } else if (isElectronProduction()) {
    console.log('[PlatformFetch] Electron production detected - using IPC proxy')
  } else {
    console.log('[PlatformFetch] Web dev mode - using Vite proxy')
  }
}
