import { Howl, Howler } from 'howler'
import { ref, watch } from 'vue'
import type { Track, MusicQuality, ParsedSourcePlugin, SourceResolveResult } from '@/types'
import { resolveWithAutoSwitch, resolveLyric, searchItemToTrack } from '@/services/sourceResolver'
import { getEqualizer } from '@/services/audioEffects'

// Module-level source plugin cache (set by SourceView via setPlayerSourcePlugins)
let playerPlugins: ParsedSourcePlugin[] = []
let playerAutoSwitch = true

export function setPlayerSourcePlugins(plugins: ParsedSourcePlugin[], isAutoSwitch: boolean) {
  playerPlugins = plugins
  playerAutoSwitch = isAutoSwitch
}

function getSourcePlugins(): {
  plugins: ParsedSourcePlugin[]
  isAutoSwitch: boolean
} {
  return { plugins: playerPlugins, isAutoSwitch: playerAutoSwitch }
}

function getPreferredQuality(): MusicQuality {
  try {
    const stored = localStorage.getItem('audio-player-quality')
    if (stored) return JSON.parse(stored) as MusicQuality
  } catch { /* ignore */ }
  return '320k'
}

// Singleton state shared across the app
const currentTrack = ref<Track | null>(null)
const playlist = ref<Track[]>([])
const currentIndex = ref<number>(-1)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)
const isMuted = ref(false)
const playMode = ref<'sequence' | 'loop' | 'shuffle' | 'single'>('sequence')
const isLoading = ref(false)
const error = ref<string | null>(null)
const isResolving = ref(false)
const resolveStatus = ref('')
const currentResolveInfo = ref<SourceResolveResult | null>(null)

let howlInstance: Howl | null = null
let seekInterval: ReturnType<typeof setInterval> | null = null

function clearSeekInterval() {
  if (seekInterval) {
    clearInterval(seekInterval)
    seekInterval = null
  }
}

function startSeekInterval() {
  clearSeekInterval()
  seekInterval = setInterval(() => {
    if (howlInstance && howlInstance.playing()) {
      currentTime.value = howlInstance.seek() as number
    }
  }, 250)
}

function stopAndUnload() {
  clearSeekInterval()
  if (howlInstance) {
    howlInstance.unload()
    howlInstance = null
  }
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
}

function getRandomIndex(exclude: number, max: number): number {
  if (max <= 1) return 0
  let idx: number
  do {
    idx = Math.floor(Math.random() * max)
  } while (idx === exclude)
  return idx
}

function getNextIndex(): number {
  const len = playlist.value.length
  if (len === 0) return -1
  switch (playMode.value) {
    case 'single': return currentIndex.value
    case 'shuffle': return getRandomIndex(currentIndex.value, len)
    case 'loop': return (currentIndex.value + 1) % len
    default: return currentIndex.value + 1 >= len ? -1 : currentIndex.value + 1
  }
}

function getPrevIndex(): number {
  const len = playlist.value.length
  if (len === 0) return -1
  switch (playMode.value) {
    case 'shuffle': return getRandomIndex(currentIndex.value, len)
    case 'loop': return (currentIndex.value - 1 + len) % len
    default: return currentIndex.value - 1 < 0 ? -1 : currentIndex.value - 1
  }
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function useAudioPlayer() {
  /**
   * Main play function — resolves URL through source plugins if needed
   */
  async function loadAndPlay(track: Track) {
    stopAndUnload()
    isLoading.value = true
    isResolving.value = false
    error.value = null
    resolveStatus.value = ''
    currentResolveInfo.value = null
    currentTrack.value = track

    // Direct URL (no source info) — play immediately
    if (track.url && track.url.startsWith('http') && !track.sourceId) {
      playWithUrl(track.url, track)
      return
    }

    // Previously resolved URL — play it and fetch lyrics if not cached
    if (track.url && track.url.startsWith('http')) {
      // Fetch lyrics in background if not already cached
      if (!track.lrc && track.source) {
        const { plugins } = getSourcePlugins()
        if (plugins.length > 0) {
          fetchTrackLyrics(track, plugins)
        }
      }
      playWithUrl(track.url, track)
      return
    }

    // No URL — need to resolve through source plugins
    await resolveAndPlay(track)
  }

  /**
   * Resolve track URL through source plugins then play
   */
  async function resolveAndPlay(track: Track, quality?: MusicQuality) {
    const { plugins } = getSourcePlugins()

    if (plugins.length === 0) {
      isLoading.value = false
      isResolving.value = false
      error.value = '没有可用的音源插件，请先在"音源管理"页面导入并启用音源'
      return
    }

    isResolving.value = true
    resolveStatus.value = `正在解析: ${track.title}...`

    try {
      const result = await resolveWithAutoSwitch(track, quality || getPreferredQuality(), plugins)
      isResolving.value = false
      currentResolveInfo.value = result
      resolveStatus.value = `${result.pluginName} · ${result.source.toUpperCase()} · ${result.quality}`
      track.url = result.url
      currentTrack.value = { ...track }
      // Use lyrics bundled with musicUrl response if available, otherwise fetch separately
      if (result.lyric) {
        track.lrc = result.lyric
        if (result.tlyric) track.tlyric = result.tlyric
        currentTrack.value = { ...track }
        console.log(`[AudioPlayer] Lyrics bundled with musicUrl response: ${result.lyric.substring(0, 60)}...`)
      } else {
        console.log(`[AudioPlayer] No lyrics in musicUrl response, fetching separately...`)
        await fetchTrackLyrics(track, plugins)
      }
      playWithUrl(result.url, track)
    } catch (e: any) {
      isResolving.value = false
      isLoading.value = false
      const errMsg = e.message || '解析失败'
      error.value = errMsg
      resolveStatus.value = `播放失败: ${errMsg}`
      console.error('[AudioPlayer] Resolve failed:', e)

      // Auto-play next track when all sources failed
      const nextIdx = getNextIndex()
      if (nextIdx >= 0 && playlist.value.length > 1) {
        console.log(`[AudioPlayer] All sources failed for "${track.title}", skipping to next...`)
        setTimeout(() => {
          error.value = null
          currentIndex.value = nextIdx
          loadAndPlay(playlist.value[nextIdx])
        }, 1000)
      }
    }
  }

  function playWithUrl(url: string, track: Track) {
    isLoading.value = true
    error.value = null

    howlInstance = new Howl({
      src: [url],
      html5: true,
      format: ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac', 'webm'],
      volume: isMuted.value ? 0 : volume.value,
      xhr: { withCredentials: false },
      onload: () => {
        isLoading.value = false
        duration.value = howlInstance?.duration() ?? 0
        if (track.duration && track.duration > 0) duration.value = track.duration
      },
      onloaderror: (_id, err) => {
        isLoading.value = false
        error.value = `加载失败: ${err}`
        console.error('Howl load error:', err)
        // Auto-switch on load error if track has source info
        const { plugins, isAutoSwitch } = getSourcePlugins()
        if (track.source && isAutoSwitch && plugins.length > 0) {
          error.value = '音源失效，正在切换...'
          resolveAndPlay(track)
        }
      },
      onplayerror: (_id, err) => {
        isLoading.value = false
        error.value = `播放失败: ${err}`
        console.error('Howl play error:', err)
        const { plugins, isAutoSwitch } = getSourcePlugins()
        if (track.source && isAutoSwitch && plugins.length > 0) {
          error.value = '音源失效，正在切换...'
          resolveAndPlay(track)
        }
      },
      onplay: () => {
        isPlaying.value = true
        isLoading.value = false
        startSeekInterval()
        // Auto-initialize AudioEqualizer on first play (for real spectrum data)
        getEqualizer().initialize()
      },
      onpause: () => {
        isPlaying.value = false
        clearSeekInterval()
      },
      onstop: () => {
        isPlaying.value = false
        clearSeekInterval()
      },
      onend: () => {
        clearSeekInterval()
        isPlaying.value = false
        const nextIdx = getNextIndex()
        if (nextIdx >= 0 && nextIdx !== currentIndex.value) {
          currentIndex.value = nextIdx
          loadAndPlay(playlist.value[nextIdx])
        } else if (playMode.value === 'single' && playlist.value.length > 0) {
          seek(0)
          play()
        }
      },
    })

    howlInstance.play()
  }

  async function fetchTrackLyrics(track: Track, plugins: ParsedSourcePlugin[]) {
    try {
      console.log(`[AudioPlayer] fetchTrackLyrics: "${track.title}" (source=${track.source})`)
      const result = await resolveLyric(track, plugins)
      if (result?.lyric) {
        track.lrc = result.lyric
        if (result.tlyric) track.tlyric = result.tlyric
        currentTrack.value = { ...track }
        console.log(`[AudioPlayer] Lyrics set for "${track.title}", length=${result.lyric.length}`)
      } else {
        console.log(`[AudioPlayer] No lyrics found for "${track.title}"`)
      }
    } catch (e) {
      console.warn('[AudioPlayer] fetchTrackLyrics failed:', e)
    }
  }

  /**
   * Play a search result (from searchSongs API)
   */
  async function playSearchItem(item: any) {
    const track = searchItemToTrack(item)
    addToPlaylist(track)
    const idx = playlist.value.length - 1
    currentIndex.value = idx
    await loadAndPlay(track)
  }

  function play() {
    if (!howlInstance) {
      if (playlist.value.length > 0 && currentIndex.value >= 0) {
        loadAndPlay(playlist.value[currentIndex.value])
      }
      return
    }
    howlInstance.play()
  }

  function pause() {
    howlInstance?.pause()
  }

  function togglePlay() {
    if (isPlaying.value) pause()
    else play()
  }

  function stop() {
    howlInstance?.stop()
    stopAndUnload()
  }

  function seek(time: number) {
    if (howlInstance) {
      howlInstance.seek(time)
      currentTime.value = time
    }
  }

  function seekByPercent(percent: number) {
    if (howlInstance && duration.value > 0) seek(duration.value * percent)
  }

  function setVolume(vol: number) {
    volume.value = Math.max(0, Math.min(1, vol))
    Howler.volume(isMuted.value ? 0 : volume.value)
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
    Howler.volume(isMuted.value ? 0 : volume.value)
  }

  function setPlayMode(mode: 'sequence' | 'loop' | 'shuffle' | 'single') {
    playMode.value = mode
  }

  function cyclePlayMode() {
    const modes: Array<'sequence' | 'loop' | 'shuffle' | 'single'> = ['sequence', 'loop', 'shuffle', 'single']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  function setPlaylist(tracks: Track[]) {
    playlist.value = tracks
    if (currentIndex.value >= tracks.length) currentIndex.value = tracks.length > 0 ? 0 : -1
  }

  function addToPlaylist(track: Track) {
    const exists = playlist.value.some(t => t.id === track.id)
    if (!exists) playlist.value.push(track)
  }

  function removeFromPlaylist(index: number) {
    if (index < 0 || index >= playlist.value.length) return
    playlist.value.splice(index, 1)
    if (playlist.value.length === 0) {
      stopAndUnload()
      currentTrack.value = null
      currentIndex.value = -1
      return
    }
    if (index === currentIndex.value) {
      stopAndUnload()
      currentIndex.value = Math.min(index, playlist.value.length - 1)
      loadAndPlay(playlist.value[currentIndex.value])
    } else if (index < currentIndex.value) {
      currentIndex.value--
    }
  }

  function clearPlaylist() {
    stopAndUnload()
    playlist.value = []
    currentIndex.value = -1
    currentTrack.value = null
  }

  function playTrack(index: number) {
    if (index < 0 || index >= playlist.value.length) return
    currentIndex.value = index
    loadAndPlay(playlist.value[index])
  }

  function playNext() {
    const nextIdx = getNextIndex()
    if (nextIdx >= 0) {
      currentIndex.value = nextIdx
      loadAndPlay(playlist.value[nextIdx])
    }
  }

  function playPrev() {
    const prevIdx = getPrevIndex()
    if (prevIdx >= 0) {
      currentIndex.value = prevIdx
      loadAndPlay(playlist.value[prevIdx])
    }
  }

  function playUrl(url: string, title?: string, artist?: string, cover?: string) {
    const track: Track = {
      id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || new URL(url).pathname.split('/').pop() || '未知曲目',
      artist: artist || '未知艺术家',
      url,
      cover,
    }
    addToPlaylist(track)
    playTrack(playlist.value.length - 1)
  }

  function destroy() {
    stopAndUnload()
    Howler.unload()
  }

  // Computed-like (updated via interval for singleton compatibility)
  const progress = ref(0)
  const hasTrack = ref(false)
  const formattedCurrentTime = ref('0:00')
  const formattedDuration = ref('0:00')

  setInterval(() => {
    progress.value = duration.value > 0 ? currentTime.value / duration.value : 0
    hasTrack.value = currentTrack.value !== null
    formattedCurrentTime.value = formatTime(currentTime.value)
    formattedDuration.value = formatTime(duration.value)
  }, 100)

  return {
    // State
    currentTrack, playlist, currentIndex, isPlaying, currentTime, duration,
    volume, isMuted, playMode, isLoading, error, isResolving, resolveStatus,
    currentResolveInfo,
    // Computed
    progress, hasTrack, formattedCurrentTime, formattedDuration,
    // Methods
    play, pause, togglePlay, stop, seek, seekByPercent, setVolume, toggleMute,
    setPlayMode, cyclePlayMode,
    // Playlist
    setPlaylist, addToPlaylist, removeFromPlaylist, clearPlaylist,
    playTrack, playNext, playPrev, playUrl,
    // Source-aware
    loadAndPlay, resolveAndPlay, playSearchItem, fetchTrackLyrics,
    // Lifecycle
    destroy,
  }
}

// Initialize volume from localStorage
try {
  const savedVol = localStorage.getItem('audio-player-volume')
  if (savedVol !== null) {
    volume.value = parseFloat(savedVol)
    Howler.volume(volume.value)
  }
} catch { /* ignore */ }

watch(volume, (v) => {
  Howler.volume(isMuted.value ? 0 : v)
  try { localStorage.setItem('audio-player-volume', v.toString()) } catch { /* ignore */ }
})
