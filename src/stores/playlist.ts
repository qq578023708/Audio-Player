import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Track, PlaylistFolder, MusicCategory } from '@/types'

const STORAGE_KEY_PLAYLIST = 'audio-player-playlist'
const STORAGE_KEY_FOLDERS = 'audio-player-folders'
const STORAGE_KEY_HISTORY = 'audio-player-history'
const STORAGE_KEY_FAVORITES = 'audio-player-favorites'
const STORAGE_KEY_CATEGORIES = 'audio-player-categories'

export const usePlaylistStore = defineStore('playlist', () => {
  // State
  const playlist = ref<Track[]>(loadFromStorage<Track[]>(STORAGE_KEY_PLAYLIST, []))
  const folders = ref<PlaylistFolder[]>(loadFromStorage<PlaylistFolder[]>(STORAGE_KEY_FOLDERS, []))
  const history = ref<Track[]>(loadFromStorage<Track[]>(STORAGE_KEY_HISTORY, []))
  const favorites = ref<Track[]>(loadFromStorage<Track[]>(STORAGE_KEY_FAVORITES, []))
  const categories = ref<MusicCategory[]>(loadFromStorage<MusicCategory[]>(STORAGE_KEY_CATEGORIES, defaultCategories))
  const activeFolderId = ref<string | null>(null)

  // Computed
  const activeFolder = computed(() => {
    if (!activeFolderId.value) return null
    return folders.value.find(f => f.id === activeFolderId.value) || null
  })

  const folderNames = computed(() => folders.value.map(f => f.name))

  const favoriteIds = computed(() => new Set(favorites.value.map(t => t.id)))

  const isFavorite = (trackId: string): boolean => {
    return favorites.value.some(t => t.id === trackId)
  }

  // Actions
  function addTrack(track: Track) {
    const exists = playlist.value.some(t => t.url === track.url)
    if (!exists) {
      playlist.value.push({ ...track })
      savePlaylist()
    }
  }

  function addTracks(tracks: Track[]) {
    for (const track of tracks) {
      const exists = playlist.value.some(t => t.url === track.url)
      if (!exists) {
        playlist.value.push({ ...track })
      }
    }
    savePlaylist()
  }

  function removeTrack(index: number) {
    playlist.value.splice(index, 1)
    savePlaylist()
  }

  function clearPlaylist() {
    playlist.value = []
    savePlaylist()
  }

  function moveTrack(from: number, to: number) {
    const [track] = playlist.value.splice(from, 1)
    playlist.value.splice(to, 0, track)
    savePlaylist()
  }

  // Folders
  function createFolder(name: string, description?: string, category?: string) {
    const folder: PlaylistFolder = {
      id: `folder_${Date.now()}`,
      name,
      description,
      category,
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    folders.value.push(folder)
    saveFolders()
    return folder
  }

  function updateFolder(folderId: string, data: { name?: string; description?: string; category?: string; cover?: string }) {
    const folder = folders.value.find(f => f.id === folderId)
    if (folder) {
      if (data.name !== undefined) folder.name = data.name
      if (data.description !== undefined) folder.description = data.description
      if (data.category !== undefined) folder.category = data.category
      if (data.cover !== undefined) folder.cover = data.cover
      folder.updatedAt = Date.now()
      saveFolders()
    }
  }

  function deleteFolder(folderId: string) {
    folders.value = folders.value.filter(f => f.id !== folderId)
    if (activeFolderId.value === folderId) {
      activeFolderId.value = null
    }
    saveFolders()
  }

  function addTrackToFolder(folderId: string, track: Track) {
    const folder = folders.value.find(f => f.id === folderId)
    if (folder) {
      const exists = folder.tracks.some(t => t.url === track.url)
      if (!exists) {
        folder.tracks.push({ ...track })
        folder.updatedAt = Date.now()
        saveFolders()
      }
    }
  }

  function removeTrackFromFolder(folderId: string, trackIndex: number) {
    const folder = folders.value.find(f => f.id === folderId)
    if (folder) {
      folder.tracks.splice(trackIndex, 1)
      folder.updatedAt = Date.now()
      saveFolders()
    }
  }

  function setActiveFolder(folderId: string | null) {
    activeFolderId.value = folderId
  }

  // Favorites
  function toggleFavorite(track: Track) {
    const index = favorites.value.findIndex(t => t.id === track.id)
    if (index >= 0) {
      favorites.value.splice(index, 1)
    } else {
      favorites.value.unshift({ ...track, isFavorite: true })
    }
    saveFavorites()
    // Also update playlist track favorite status
    const plTrack = playlist.value.find(t => t.id === track.id)
    if (plTrack) plTrack.isFavorite = isFavorite(track.id)
  }

  function removeFavorite(trackId: string) {
    const index = favorites.value.findIndex(t => t.id === trackId)
    if (index >= 0) {
      favorites.value.splice(index, 1)
      saveFavorites()
    }
  }

  function clearFavorites() {
    favorites.value = []
    saveFavorites()
  }

  // History
  function addToHistory(track: Track) {
    const exists = history.value.findIndex(t => t.url === track.url)
    if (exists >= 0) {
      history.value.splice(exists, 1)
    }
    history.value.unshift({ ...track, duration: track.duration || 0 })
    if (history.value.length > 100) {
      history.value = history.value.slice(0, 100)
    }
    saveHistory()
  }

  function clearHistory() {
    history.value = []
    saveHistory()
  }

  // Categories
  function addCategory(name: string, icon: string, color: string, description?: string) {
    const cat: MusicCategory = {
      id: `cat_${Date.now()}`,
      name,
      icon,
      color,
      description
    }
    categories.value.push(cat)
    saveCategories()
    return cat
  }

  function removeCategory(id: string) {
    categories.value = categories.value.filter(c => c.id !== id)
    saveCategories()
  }

  function getFoldersByCategory(categoryId: string) {
    return folders.value.filter(f => f.category === categoryId)
  }

  // Import/Export
  function exportPlaylist(): string {
    return JSON.stringify(playlist.value, null, 2)
  }

  function importPlaylist(json: string): boolean {
    try {
      const tracks = JSON.parse(json) as Track[]
      if (Array.isArray(tracks)) {
        addTracks(tracks)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  function exportFolders(): string {
    return JSON.stringify(folders.value, null, 2)
  }

  // Persistence
  function savePlaylist() {
    saveToStorage(STORAGE_KEY_PLAYLIST, playlist.value)
  }

  function saveFolders() {
    saveToStorage(STORAGE_KEY_FOLDERS, folders.value)
  }

  function saveHistory() {
    saveToStorage(STORAGE_KEY_HISTORY, history.value)
  }

  function saveFavorites() {
    saveToStorage(STORAGE_KEY_FAVORITES, favorites.value)
  }

  function saveCategories() {
    saveToStorage(STORAGE_KEY_CATEGORIES, categories.value)
  }

  return {
    playlist,
    folders,
    history,
    favorites,
    categories,
    activeFolderId,
    activeFolder,
    folderNames,
    favoriteIds,
    isFavorite,

    addTrack,
    addTracks,
    removeTrack,
    clearPlaylist,
    moveTrack,

    createFolder,
    updateFolder,
    deleteFolder,
    addTrackToFolder,
    removeTrackFromFolder,
    setActiveFolder,

    toggleFavorite,
    removeFavorite,
    clearFavorites,

    addToHistory,
    clearHistory,

    addCategory,
    removeCategory,
    getFoldersByCategory,

    exportPlaylist,
    importPlaylist,
    exportFolders
  }
})

// Default categories
const defaultCategories: MusicCategory[] = [
  { id: 'cat_pop', name: '流行', icon: 'star', color: '#f59e0b', description: '流行音乐精选' },
  { id: 'cat_rock', name: '摇滚', icon: 'zap', color: '#ef4444', description: '摇滚经典与新声' },
  { id: 'cat_jazz', name: '爵士', icon: 'disc', color: '#8b5cf6', description: '爵士蓝调风情' },
  { id: 'cat_classical', name: '古典', icon: 'music', color: '#3b82f6', description: '古典音乐殿堂' },
  { id: 'cat_electronic', name: '电子', icon: 'activity', color: '#06b6d4', description: '电子舞曲空间' },
  { id: 'cat_folk', name: '民谣', icon: 'guitar', color: '#22c55e', description: '民谣文艺清新' },
  { id: 'cat_hiphop', name: '嘻哈', icon: 'mic', color: '#f97316', description: '嘻哈说唱文化' },
  { id: 'cat_rnb', name: 'R&B', icon: 'heart', color: '#ec4899', description: 'R&B灵魂之声' },
]

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    if (data) {
      return JSON.parse(data) as T
    }
  } catch {
    // ignore
  }
  return defaultValue
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore
  }
}
