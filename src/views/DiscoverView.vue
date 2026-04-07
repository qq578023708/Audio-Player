<template>
  <div class="discover-view">
    <!-- Hero banner with search -->
    <div class="hero-banner">
      <div class="hero-content">
        <h1 class="hero-title">发现好音乐</h1>
        <p class="hero-desc">搜索歌曲、歌手，通过音源插件解析播放</p>
        <div class="hero-search">
          <SvgIcon name="search" :size="18" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索歌曲、歌手、专辑..."
            @keydown.enter="handleSearch"
          />
          <button class="hero-search-btn" @click="handleSearch" :disabled="!searchKeyword.trim() || isSearching">
            <SvgIcon v-if="!isSearching" name="search" :size="16" />
            <SvgIcon v-else name="loader" :size="16" class="spinning" />
            搜索
          </button>
        </div>
      </div>
      <div class="hero-visual">
        <SvgIcon name="headphones" :size="80" />
      </div>
    </div>

    <!-- Search results -->
    <section class="section" v-if="searchResults.length > 0">
      <div class="section-header">
        <h2 class="section-title">
          搜索结果
          <span class="search-count">（{{ searchResults.length }} 首）</span>
        </h2>
        <div class="search-source-filter">
          <button
            v-for="src in searchSourceOptions"
            :key="src.value"
            class="source-filter-btn"
            :class="{ active: searchSource === src.value }"
            @click="searchSource = src.value; handleSearch()"
          >
            {{ src.label }}
          </button>
        </div>
      </div>
      <div class="track-table">
        <div
          v-for="(item, index) in searchResults"
          :key="`${item.source}_${item.id}`"
          class="track-row"
          :class="{ active: isPlayingSearchItem(item) }"
          @dblclick="playSearchResult(item)"
        >
          <div class="track-col index">
            <SvgIcon
              v-if="isPlayingSearchItem(item)"
              name="volume-high"
              :size="14"
              class="playing-icon"
            />
            <span v-else>{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <div class="track-col info">
            <div class="track-title">{{ item.name }}</div>
            <div class="track-artist">{{ item.singer }}</div>
          </div>
          <div class="track-col album" v-if="item.album">{{ item.album }}</div>
          <div class="track-col source-tag-wrap">
            <span class="source-badge" :style="{ background: SOURCE_COLORS[item.source] || '#666' }">
              {{ SOURCE_NAMES[item.source] || item.source.toUpperCase() }}
            </span>
          </div>
          <div class="track-col duration" v-if="item.duration">{{ formatTime(item.duration) }}</div>
          <div class="track-col actions">
            <button class="play-btn-sm" @click="playSearchResult(item)" title="播放">
              <SvgIcon name="play" :size="14" />
            </button>
          </div>
        </div>
      </div>
      <div class="search-status" v-if="player.isResolving.value">
        <SvgIcon name="loader" :size="14" class="spinning" />
        {{ player.resolveStatus.value }}
      </div>
      <div class="search-status error" v-else-if="player.error.value">
        {{ player.error.value }}
      </div>
    </section>

    <!-- Search loading -->
    <section class="section" v-if="isSearching">
      <div class="search-loading">
        <SvgIcon name="loader" :size="24" class="spinning" />
        <span>正在搜索...</span>
      </div>
    </section>

    <!-- Search no results -->
    <section class="section" v-if="hasSearched && searchResults.length === 0 && !isSearching">
      <div class="search-no-result">
        <SvgIcon name="search" :size="32" />
        <p>未找到相关结果</p>
        <p class="hint">请尝试其他关键词，或确认音源插件已启用</p>
      </div>
    </section>

    <!-- Music categories -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">音乐分类</h2>
      </div>
      <div class="category-grid">
        <div
          v-for="cat in store.categories"
          :key="cat.id"
          class="category-card"
          :style="{ '--cat-color': cat.color }"
          @click="filterByCategory(cat.id)"
        >
          <div class="cat-icon-wrap">
            <SvgIcon :name="cat.icon" :size="24" />
          </div>
          <div class="cat-name">{{ cat.name }}</div>
          <div class="cat-count">{{ getFolderCount(cat.id) }} 个歌单</div>
        </div>
      </div>
    </section>

    <!-- Recent playlists -->
    <section class="section" v-if="store.folders.length > 0">
      <div class="section-header">
        <h2 class="section-title">我的歌单</h2>
        <router-link to="/playlist" class="section-more">
          查看全部
          <SvgIcon name="chevron-right" :size="14" />
        </router-link>
      </div>
      <div class="folder-grid">
        <router-link
          v-for="folder in recentFolders"
          :key="folder.id"
          :to="`/folder/${folder.id}`"
          class="folder-card"
        >
          <div class="folder-cover" :style="{ background: getRandomGradient(folder.id) }">
            <SvgIcon name="folder" :size="32" />
            <div class="folder-play-count">
              <SvgIcon name="music" :size="12" />
              {{ folder.tracks.length }}
            </div>
          </div>
          <div class="folder-info">
            <div class="folder-name">{{ folder.name }}</div>
            <div class="folder-meta">{{ folder.tracks.length }} 首</div>
          </div>
        </router-link>
        <div class="folder-card add-new" @click="showCreateFolder = true">
          <div class="folder-cover dashed">
            <SvgIcon name="plus" :size="28" />
          </div>
          <div class="folder-info">
            <div class="folder-name">创建歌单</div>
            <div class="folder-meta">新建歌单</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Recent history -->
    <section class="section" v-if="store.history.length > 0">
      <div class="section-header">
        <h2 class="section-title">最近播放</h2>
        <router-link to="/history" class="section-more">
          查看全部
          <SvgIcon name="chevron-right" :size="14" />
        </router-link>
      </div>
      <div class="track-table">
        <div
          v-for="(track, index) in store.history.slice(0, 10)"
          :key="track.id"
          class="track-row"
          :class="{ active: player.currentTrack.value?.id === track.id }"
          @dblclick="playHistoryTrack(track)"
        >
          <div class="track-col index">{{ String(index + 1).padStart(2, '0') }}</div>
          <div class="track-col info">
            <div class="track-title">{{ track.title }}</div>
            <div class="track-artist">{{ track.artist }}</div>
          </div>
          <div class="track-col album" v-if="track.album">{{ track.album }}</div>
          <div class="track-col duration" v-if="track.duration">{{ formatTime(track.duration) }}</div>
        </div>
      </div>
    </section>

    <!-- Demo tracks -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">试听示例</h2>
      </div>
      <div class="demo-grid">
        <div
          v-for="(track, i) in demoTracks"
          :key="i"
          class="demo-card"
          @click="player.playUrl(track.url, track.title, track.artist)"
        >
          <div class="demo-cover" :style="{ background: demoGradients[i] }">
            <SvgIcon name="play" :size="28" class="demo-play-icon" />
          </div>
          <div class="demo-title">{{ track.title }}</div>
          <div class="demo-artist">{{ track.artist }}</div>
        </div>
      </div>
    </section>

    <!-- No content -->
    <div class="empty-guide" v-if="store.folders.length === 0 && store.history.length === 0">
      <SvgIcon name="music" :size="48" />
      <p>开始你的音乐之旅</p>
      <p class="hint">添加音乐 URL 或创建歌单开始使用</p>
    </div>

    <!-- Create folder modal -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showCreateFolder" @click.self="showCreateFolder = false">
        <div class="modal-box">
          <h3>创建歌单</h3>
          <input v-model="newFolderName" placeholder="歌单名称" @keydown.enter="createFolder" />
          <input v-model="newFolderDesc" placeholder="描述（可选）" />
          <select v-model="newFolderCat">
            <option value="">未分类</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <div class="modal-btns">
            <button @click="showCreateFolder = false">取消</button>
            <button class="primary" @click="createFolder" :disabled="!newFolderName.trim()">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'
import { useSourceStore } from '@/stores/source'
import { searchSongs, searchItemToTrack } from '@/services/sourceResolver'
import { SOURCE_NAMES, SOURCE_COLORS } from '@/services/sourceParser'
import type { Track, MusicSource, SearchTrackItem } from '@/types'

const player = useAudioPlayer()
const store = usePlaylistStore()
const sourceStore = useSourceStore()
const router = useRouter()

// Search state
const searchKeyword = ref('')
const searchResults = ref<SearchTrackItem[]>([])
const searchSource = ref<MusicSource | 'all'>('all')
const isSearching = ref(false)
const hasSearched = ref(false)
const lastPlayedSearchId = ref('')

const searchSourceOptions = [
  { label: '全部', value: 'all' as const },
  { label: '酷我', value: 'kw' as MusicSource },
  { label: '酷狗', value: 'kg' as MusicSource },
  { label: '网易云', value: 'wy' as MusicSource },
  { label: 'QQ', value: 'tx' as MusicSource },
]

async function handleSearch() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return

  isSearching.value = true
  hasSearched.value = true
  searchResults.value = []

  try {
    const source = searchSource.value === 'all' ? undefined : searchSource.value as MusicSource
    const results = await searchSongs(keyword, source, 1, 50)
    searchResults.value = results
  } catch (e) {
    console.error('[DiscoverView] Search failed:', e)
    searchResults.value = []
  }

  isSearching.value = false
}

function isPlayingSearchItem(item: SearchTrackItem): boolean {
  return lastPlayedSearchId.value === `${item.source}_${item.id}`
}

async function playSearchResult(item: SearchTrackItem) {
  lastPlayedSearchId.value = `${item.source}_${item.id}`

  // Check if we have source plugins
  if (sourceStore.enabledPlugins.length === 0) {
    player.error.value = '请先在"音源管理"页面导入并启用音源插件'
    return
  }

  const track = searchItemToTrack(item)
  player.addToPlaylist(track)
  player.currentTrack.value = track
  player.currentIndex.value = player.playlist.value.length - 1
  await player.loadAndPlay(track)
}

// Folder state
const showCreateFolder = ref(false)
const newFolderName = ref('')
const newFolderDesc = ref('')
const newFolderCat = ref('')

const recentFolders = computed(() => {
  return [...store.folders].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
})

function getFolderCount(catId: string): number {
  return store.folders.filter(f => f.category === catId).length
}

function filterByCategory(catId: string) {
  router.push({ name: 'playlist', query: { category: catId } })
}

function playHistoryTrack(track: Track) {
  // If track has source info, use resolveAndPlay
  if (track.source && track.sourceId) {
    player.addToPlaylist(track)
    player.currentTrack.value = track
    player.currentIndex.value = player.playlist.value.length - 1
    player.loadAndPlay(track)
  } else {
    player.playUrl(track.url, track.title, track.artist, track.cover)
  }
}

function createFolder() {
  if (!newFolderName.value.trim()) return
  store.createFolder(newFolderName.value.trim(), newFolderDesc.value.trim() || undefined, newFolderCat.value || undefined)
  newFolderName.value = ''
  newFolderDesc.value = ''
  newFolderCat.value = ''
  showCreateFolder.value = false
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const gradients = [
  'linear-gradient(135deg, #ff6a00, #ff2d55)',
  'linear-gradient(135deg, #5b8cff, #8b5cf6)',
  'linear-gradient(135deg, #30d158, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
]

function getRandomGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}

const demoTracks = [
  { title: '古典钢琴 - 月光奏鸣曲', artist: 'Beethoven', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: '电子音乐 - SoundHelix 2', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: '摇滚节拍 - SoundHelix 3', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: '氛围音乐 - SoundHelix 6', artist: 'SoundHelix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
]

const demoGradients = [
  'linear-gradient(135deg, #1a1a3e, #4a2c82)',
  'linear-gradient(135deg, #0d2137, #1a6b5a)',
  'linear-gradient(135deg, #3d1a0a, #8b3a1a)',
  'linear-gradient(135deg, #1a2a0d, #3a6b1a)',
]
</script>

<style scoped>
.discover-view {
  padding: 24px;
  max-width: 1000px;
}

/* Hero */
.hero-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 40px;
  margin-bottom: 32px;
  gap: 40px;
  overflow: hidden;
  position: relative;
}

.hero-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, var(--accent-glow), transparent 70%);
  pointer-events: none;
}

.hero-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.hero-desc {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.hero-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.hero-visual {
  color: var(--accent);
  opacity: 0.2;
}

/* Hero search */
.hero-search {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 6px 6px 6px 16px;
  margin-top: 20px;
  transition: all var(--transition-fast);
}

.hero-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.hero-search svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.hero-search input {
  flex: 1;
  min-width: 0;
  padding: 10px 4px;
  font-size: 14px;
  background: transparent;
  border: none;
  color: var(--text-primary);
}

.hero-search input::placeholder {
  color: var(--text-muted);
}

.hero-search input:focus {
  outline: none;
}

.hero-search-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.hero-search-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.hero-search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Search results */
.search-count {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-muted);
}

.search-source-filter {
  display: flex;
  gap: 6px;
}

.source-filter-btn {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.source-filter-btn:hover {
  background: var(--bg-hover);
}

.source-filter-btn.active {
  background: var(--accent);
  color: #fff;
}

.source-tag-wrap {
  width: 60px;
  flex-shrink: 0;
}

.source-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  color: #fff;
  font-weight: 500;
}

.track-col.actions {
  width: 36px;
  flex-shrink: 0;
  text-align: center;
}

.play-btn-sm {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.play-btn-sm:hover {
  background: var(--accent);
  color: #fff;
}

.playing-icon {
  color: var(--accent);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.search-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.search-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.search-no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
  text-align: center;
}

.search-no-result p {
  font-size: 14px;
}

.search-no-result .hint {
  font-size: 12px;
  opacity: 0.6;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Sections */
.section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
}

.section-more {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.section-more:hover {
  color: var(--accent);
}

/* Category grid */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.category-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  transform: translateY(-2px);
}

.cat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cat-color) 15%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cat-color);
}

.cat-name {
  font-size: 13px;
  font-weight: 600;
}

.cat-count {
  font-size: 11px;
  color: var(--text-muted);
}

/* Folder grid */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.folder-card {
  text-decoration: none;
  cursor: pointer;
}

.folder-cover {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  overflow: hidden;
  transition: transform var(--transition-fast);
}

.folder-card:hover .folder-cover {
  transform: scale(1.02);
}

.folder-cover.dashed {
  background: var(--bg-secondary) !important;
  border: 2px dashed var(--border-light);
  color: var(--text-muted);
}

.folder-play-count {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.4);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.folder-name {
  font-size: 13px;
  font-weight: 500;
  margin-top: 8px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Track table */
.track-table {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.track-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.track-row:hover {
  background: var(--bg-hover);
}

.track-row.active {
  background: var(--accent-subtle);
}

.track-row.active .track-title {
  color: var(--accent);
}

.track-col.index {
  width: 32px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: center;
  flex-shrink: 0;
}

.track-col.info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 12px;
  color: var(--text-muted);
}

.track-col.album {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-col.duration {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

/* Demo grid */
.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.demo-card {
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.demo-card:hover {
  transform: translateY(-2px);
}

.demo-cover {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  position: relative;
}

.demo-play-icon {
  opacity: 0;
  transition: opacity var(--transition-fast);
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
}

.demo-card:hover .demo-play-icon {
  opacity: 1;
}

.demo-title {
  font-size: 13px;
  font-weight: 500;
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Empty guide */
.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-guide p {
  font-size: 15px;
}

.empty-guide .hint {
  font-size: 13px;
  opacity: 0.6;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-box h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.modal-box input,
.modal-box select {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
}

.modal-box input:focus,
.modal-box select:focus {
  border-color: var(--accent);
}

.modal-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.modal-btns button {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.modal-btns button:hover {
  background: var(--bg-hover);
}

.modal-btns button.primary {
  background: var(--accent);
  color: #fff;
}

.modal-btns button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.modal-btns button.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .discover-view {
    padding: 16px;
  }
  .hero-banner {
    padding: 24px;
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }
  .hero-visual {
    display: none;
  }
  .track-col.album {
    display: none;
  }
}
</style>
