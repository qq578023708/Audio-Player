import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { MusicSource, ParsedSourcePlugin, SourceInfo, MusicQuality } from '@/types'
import { setPlayerSourcePlugins } from '@/composables/useAudioPlayer'
import { initializePlugin, uninitializePlugin } from '@/services/sourceResolver'

const STORAGE_KEY_SOURCES = 'audio-player-sources'
const STORAGE_KEY_QUALITY = 'audio-player-quality'
const STORAGE_KEY_PLUGINS = 'audio-player-plugins'

const DEFAULT_SOURCES: SourceInfo[] = [
  { source: 'kw', name: '酷我音乐', icon: 'disc', color: '#ff6a00', supported: true, priority: 1 },
  { source: 'kg', name: '酷狗音乐', icon: 'music', color: '#2196f3', supported: true, priority: 2 },
  { source: 'tx', name: 'QQ音乐', icon: 'headphones', color: '#31c27c', supported: true, priority: 3 },
  { source: 'wy', name: '网易云音乐', icon: 'heart', color: '#e60026', supported: true, priority: 4 },
  { source: 'mg', name: '咪咕音乐', icon: 'star', color: '#ff2d55', supported: true, priority: 5 },
  { source: 'url', name: '直链URL', icon: 'link', color: '#8b5cf6', supported: true, priority: 99 },
  { source: 'local', name: '本地文件', icon: 'folder', color: '#6a6a82', supported: true, priority: 100 },
]

export const useSourceStore = defineStore('source', () => {
  // State
  const sources = ref<SourceInfo[]>(loadFromStorage<SourceInfo[]>(STORAGE_KEY_SOURCES, DEFAULT_SOURCES))
  const plugins = ref<ParsedSourcePlugin[]>(loadFromStorage<ParsedSourcePlugin[]>(STORAGE_KEY_PLUGINS, []))
  const activeSource = ref<MusicSource>('kw')
  const preferredQuality = ref<MusicQuality>(loadFromStorage<MusicQuality>(STORAGE_KEY_QUALITY, '320k'))
  const isAutoSwitch = ref(true)

  // Computed
  const enabledSources = computed(() =>
    sources.value.filter(s => s.supported).sort((a, b) => a.priority - b.priority)
  )

  const activeSourceInfo = computed(() =>
    sources.value.find(s => s.source === activeSource.value)
  )

  const enabledPlugins = computed(() =>
    plugins.value.filter(p => p.enabled)
  )

  const availableQualities: MusicQuality[] = ['128k', '320k', 'flac', 'flac24bit']

  // Sync plugins to player whenever they change
  watch([enabledPlugins, isAutoSwitch], () => {
    setPlayerSourcePlugins(enabledPlugins.value, isAutoSwitch.value)
  }, { immediate: true })

  // Initialize all enabled plugins on store init
  async function initEnabledPlugins() {
    for (const plugin of plugins.value) {
      if (plugin.enabled && !plugin.initialized) {
        const success = await initializePlugin(plugin)
        plugin.initialized = success
      }
    }
    setPlayerSourcePlugins(enabledPlugins.value, isAutoSwitch.value)
  }

  // Actions
  function setSource(source: MusicSource) {
    activeSource.value = source
  }

  function setQuality(quality: MusicQuality) {
    preferredQuality.value = quality
    saveToStorage(STORAGE_KEY_QUALITY, quality)
  }

  function toggleAutoSwitch() {
    isAutoSwitch.value = !isAutoSwitch.value
  }

  function updateSourcePriority(source: MusicSource, priority: number) {
    const s = sources.value.find(s => s.source === source)
    if (s) {
      s.priority = priority
      saveToStorage(STORAGE_KEY_SOURCES, sources.value)
    }
  }

  function enableSource(source: MusicSource, enabled: boolean) {
    const s = sources.value.find(s => s.source === source)
    if (s) {
      s.supported = enabled
      saveToStorage(STORAGE_KEY_SOURCES, sources.value)
    }
  }

  // Plugin management
  async function addPlugin(plugin: ParsedSourcePlugin) {
    plugin.enabled = true
    plugin.initialized = false
    plugin.sourceCapabilities = {}

    const exists = plugins.value.findIndex(p => p.name === plugin.name)
    if (exists >= 0) {
      // Update existing
      plugins.value[exists] = plugin
    } else {
      plugins.value.push(plugin)
      // Register plugin sources in the source list
      for (const src of plugin.sources) {
        if (!sources.value.find(s => s.source === src)) {
          sources.value.push({
            source: src,
            name: `${plugin.name} (${src.toUpperCase()})`,
            icon: 'disc',
            color: '#8b5cf6',
            supported: true,
            priority: sources.value.length + 1,
          })
        }
      }
    }

    saveToStorage(STORAGE_KEY_SOURCES, sources.value)
    saveToStorage(STORAGE_KEY_PLUGINS, plugins.value)
  }

  async function enablePlugin(name: string, enabled: boolean): Promise<boolean> {
    const plugin = plugins.value.find(p => p.name === name)
    if (!plugin) return false

    plugin.enabled = enabled

    if (enabled) {
      // Initialize plugin
      const success = await initializePlugin(plugin)
      plugin.initialized = success
      if (!success) {
        plugin.enabled = false
        console.warn(`[SourceStore] Failed to initialize plugin ${name}`)
      }
      saveToStorage(STORAGE_KEY_PLUGINS, plugins.value)
      return success
    } else {
      // Uninitialize plugin
      uninitializePlugin(name)
      plugin.initialized = false
      saveToStorage(STORAGE_KEY_PLUGINS, plugins.value)
      return true
    }
  }

  function removePlugin(name: string) {
    const plugin = plugins.value.find(p => p.name === name)
    if (!plugin) return

    uninitializePlugin(name)
    plugins.value = plugins.value.filter(p => p.name !== name)
    saveToStorage(STORAGE_KEY_PLUGINS, plugins.value)
  }

  function getProxyPlugins(source: MusicSource): ParsedSourcePlugin[] {
    return plugins.value.filter(p =>
      p.enabled && p.sources.includes(source)
    )
  }

  function getNextSource(current: MusicSource): MusicSource | null {
    const sorted = enabledSources.value
    const idx = sorted.findIndex(s => s.source === current)
    if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1].source
    return null
  }

  // Init plugins on first access
  // (Call initEnabledPlugins() from app entry or SourceView mount)

  return {
    sources, plugins, activeSource, preferredQuality, isAutoSwitch,
    enabledSources, activeSourceInfo, enabledPlugins, availableQualities,
    setSource, setQuality, toggleAutoSwitch, updateSourcePriority, enableSource,
    addPlugin, enablePlugin, removePlugin, getProxyPlugins, getNextSource,
    initEnabledPlugins,
  }
})

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    if (data) return JSON.parse(data) as T
  } catch { /* ignore */ }
  return defaultValue
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* ignore */ }
}
