import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY_SETTINGS = 'audio-player-settings'

export interface AppSettings {
  // Electron specific
  minimizeToTray: boolean
  closeToTray: boolean
  
  // UI preferences
  theme: 'auto' | 'light' | 'dark'
  showNotifications: boolean
  
  // Playback
  autoPlay: boolean
  rememberPlaybackPosition: boolean
  
  // Developer
  devToolsEnabled: boolean
}

const defaultSettings: AppSettings = {
  minimizeToTray: true,
  closeToTray: true,
  theme: 'auto',
  showNotifications: true,
  autoPlay: false,
  rememberPlaybackPosition: true,
  devToolsEnabled: false,
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>(loadSettings())
  
  // Computed
  const isElectron = computed(() => !!(window as any).electronAPI?.isElectron)
  const isCapacitor = computed(() => !!(window as any).Capacitor?.isNativePlatform?.())
  
  // Actions
  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.value[key] = value
    saveSettings()
    
    // Apply setting immediately if needed
    if (key === 'minimizeToTray' || key === 'closeToTray') {
      applyElectronSettings()
    }
  }
  
  function resetSettings() {
    settings.value = { ...defaultSettings }
    saveSettings()
    applyElectronSettings()
  }
  
  function applyElectronSettings() {
    // Notify Electron main process of setting changes
    if (isElectron.value && (window as any).electronAPI?.updateSettings) {
      (window as any).electronAPI.updateSettings({
        minimizeToTray: settings.value.minimizeToTray,
        closeToTray: settings.value.closeToTray,
      })
    }
  }
  
  // Open DevTools in separate window
  async function openDevTools() {
    if (isElectron.value) {
      // Use IPC to open dev tools in separate window
      if ((window as any).electronAPI?.openDevTools) {
        await (window as any).electronAPI.openDevTools()
      } else {
        // Fallback: toggle dev tools
        console.log('[Settings] DevTools shortcut triggered')
      }
    } else {
      console.log('[Settings] DevTools only available in Electron')
    }
  }
  
  // Persistence
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings.value))
    } catch {
      // ignore
    }
  }
  
  function loadSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS)
      if (data) {
        const parsed = JSON.parse(data)
        return { ...defaultSettings, ...parsed }
      }
    } catch {
      // ignore
    }
    return { ...defaultSettings }
  }
  
  // Initialize
  function init() {
    applyElectronSettings()
  }
  
  return {
    settings,
    isElectron,
    isCapacitor,
    updateSetting,
    resetSettings,
    openDevTools,
    init,
  }
})
