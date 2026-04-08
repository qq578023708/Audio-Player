/**
 * Platform detection utilities
 * Detects Electron, Capacitor, Web environments
 */

/** True if running in Capacitor/Cordova hybrid app */
export function isCapacitor(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

/** True if running on Android */
export function isAndroid(): boolean {
  return isCapacitor() && (window as any).Capacitor?.getPlatform?.() === 'android'
}

/** True if running on iOS */
export function isIOS(): boolean {
  return isCapacitor() && (window as any).Capacitor?.getPlatform?.() === 'ios'
}

/** True if running in Electron */
export function isElectron(): boolean {
  return !!(window as any).electronAPI?.isElectron
}

/** True if running in Electron production (file:// protocol) */
export function isElectronProduction(): boolean {
  return isElectron() && window.location.protocol === 'file:'
}

/** True if running in web browser (not Electron, not Capacitor) */
export function isWeb(): boolean {
  return !isElectron() && !isCapacitor()
}

/** Get API base URL based on platform */
export function getApiBaseUrl(): string {
  if (isCapacitor()) {
    // In Capacitor, use a CORS proxy or direct API
    // For now, return empty string to use relative paths
    // TODO: Configure a proper CORS proxy for mobile
    return ''
  }
  return ''
}
