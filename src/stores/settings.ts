import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isElectron } from '@/composables/usePlatform'

export interface SettingsState {
  // Electron settings
  minimizeToTray: boolean
  // Theme settings
  theme: 'auto' | 'light' | 'dark'
  // Player settings
  autoPlay: boolean
  // Cache settings
  cacheSize: number
}

const STORAGE_KEY = 'audioflow-settings'

// Default settings
const defaultSettings: SettingsState = {
  minimizeToTray: true,
  theme: 'auto',
  autoPlay: false,
  cacheSize: 0,
}

// Save settings to file for Electron main process to read
async function saveSettingsToFile(settings: SettingsState) {
  if (!isElectron()) return
  try {
    // Use Electron's IPC to save settings to file
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(settings)
    }
  } catch (e) {
    console.error('Failed to save settings to file:', e)
  }
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<SettingsState>({ ...defaultSettings })

  // Getters
  const minimizeToTray = computed(() => settings.value.minimizeToTray)
  const theme = computed(() => settings.value.theme)
  const autoPlay = computed(() => settings.value.autoPlay)

  // Actions
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  async function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
      // Also save to file for Electron main process
      await saveSettingsToFile(settings.value)
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  async function updateSetting<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) {
    settings.value[key] = value
    await saveSettings()
  }

  async function resetSettings() {
    settings.value = { ...defaultSettings }
    await saveSettings()
  }

  // Initialize
  loadSettings()

  return {
    settings,
    minimizeToTray,
    theme,
    autoPlay,
    loadSettings,
    saveSettings,
    updateSetting,
    resetSettings,
  }
})
