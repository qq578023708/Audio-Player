<template>
  <div class="playlist-view">
    <div class="page-header">
      <h1 class="page-title">
        <SvgIcon name="list-music" :size="22" />
        播放列表
      </h1>
      <div class="header-actions">
        <button class="action-btn danger" @click="handleClearAll" v-if="player.playlist.value.length > 0">
          <SvgIcon name="trash" :size="14" />
          清空
        </button>
      </div>
    </div>

    <!-- Category filter tabs -->
    <div class="category-tabs">
      <button
        class="tab-item"
        :class="{ active: activeCategory === '' }"
        @click="activeCategory = ''"
      >
        全部
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        class="tab-item"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id"
      >
        {{ cat.name }}
      </button>
    </div>

    <!-- My folders -->
    <section class="section" v-if="filteredFolders.length > 0">
      <div class="section-header">
        <h2 class="section-title">我的歌单</h2>
        <button class="small-btn" @click="showCreate = true">
          <SvgIcon name="plus" :size="14" />
          新建歌单
        </button>
      </div>
      <div class="folder-list">
        <div
          v-for="folder in filteredFolders"
          :key="folder.id"
          class="folder-item"
        >
          <div class="folder-left" @click="$router.push(`/folder/${folder.id}`)">
            <div class="folder-icon" :style="{ background: getGradient(folder.id) }">
              <SvgIcon name="folder" :size="20" />
            </div>
            <div class="folder-meta">
              <div class="folder-name">{{ folder.name }}</div>
              <div class="folder-desc">
                {{ folder.tracks.length }} 首歌曲
                <span v-if="folder.description"> · {{ folder.description }}</span>
              </div>
            </div>
          </div>
          <div class="folder-actions">
            <button class="icon-btn" title="播放全部" @click="playAllFolder(folder.id)">
              <SvgIcon name="play" :size="16" />
            </button>
            <button class="icon-btn" title="删除歌单" @click="handleDeleteFolder(folder.id)">
              <SvgIcon name="trash" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Current play queue -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">
          当前队列
          <span class="count" v-if="player.playlist.value.length">({{ player.playlist.value.length }})</span>
        </h2>
      </div>

      <div class="track-list" v-if="player.playlist.value.length > 0">
        <div class="list-header">
          <span class="col-num">#</span>
          <span class="col-title">标题</span>
          <span class="col-artist">歌手</span>
          <span class="col-album">专辑</span>
          <span class="col-duration">时长</span>
          <span class="col-actions"></span>
        </div>
        <TransitionGroup name="list" tag="div">
          <div
            v-for="(track, index) in player.playlist.value"
            :key="track.id"
            class="list-row"
            :class="{ active: player.currentTrack.value?.id === track.id }"
            @dblclick="player.playTrack(index)"
          >
            <span class="col-num">
              <template v-if="player.currentTrack.value?.id === track.id && player.isPlaying.value">
                <div class="playing-indicator"><span /><span /><span /></div>
              </template>
              <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
            </span>
            <span class="col-title">
              <span class="fav-icon" :class="{ active: store.isFavorite(track.id) }" @click.stop="store.toggleFavorite(track)">
                <SvgIcon :name="store.isFavorite(track.id) ? 'heart-filled' : 'heart'" :size="12" />
              </span>
              {{ track.title }}
            </span>
            <span class="col-artist">{{ track.artist }}</span>
            <span class="col-album" v-if="track.album">{{ track.album }}</span>
            <span class="col-album" v-else>-</span>
            <span class="col-duration" v-if="track.duration">{{ formatTime(track.duration) }}</span>
            <span class="col-duration" v-else>-</span>
            <span class="col-actions">
              <button class="icon-btn" title="添加到歌单" @click.stop="showAddToFolder(track)">
                <SvgIcon name="plus" :size="14" />
              </button>
              <button class="icon-btn danger" title="移除" @click.stop="player.removeFromPlaylist(index)">
                <SvgIcon name="x" :size="14" />
              </button>
            </span>
          </div>
        </TransitionGroup>
      </div>

      <div class="empty-state" v-else>
        <SvgIcon name="music" :size="40" />
        <p>队列为空</p>
        <button class="action-btn primary" @click="$router.push('/add-url')">
          <SvgIcon name="plus" :size="14" />
          添加音乐
        </button>
      </div>
    </section>

    <!-- Create folder dialog -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showCreate" @click.self="showCreate = false">
        <div class="modal-box">
          <h3>创建歌单</h3>
          <input v-model="newName" placeholder="歌单名称" @keydown.enter="doCreate" />
          <input v-model="newDesc" placeholder="描述（可选）" />
          <select v-model="newCat">
            <option value="">未分类</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <div class="modal-btns">
            <button @click="showCreate = false">取消</button>
            <button class="primary" @click="doCreate" :disabled="!newName.trim()">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add to folder dialog -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showFolderPicker" @click.self="showFolderPicker = false">
        <div class="modal-box">
          <h3>添加到歌单</h3>
          <div class="folder-picker-list" v-if="store.folders.length > 0">
            <div
              v-for="folder in store.folders"
              :key="folder.id"
              class="picker-item"
              @click="doAddToFolder(folder.id)"
            >
              <SvgIcon name="folder" :size="16" />
              <span>{{ folder.name }}</span>
              <span class="picker-count">{{ folder.tracks.length }}</span>
            </div>
          </div>
          <p v-else class="picker-empty">暂无歌单，请先创建歌单</p>
          <div class="modal-btns">
            <button @click="showFolderPicker = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'
import type { Track } from '@/types'

const player = useAudioPlayer()
const store = usePlaylistStore()
const route = useRoute()

const activeCategory = ref('')
const showCreate = ref(false)
const showFolderPicker = ref(false)
const newName = ref('')
const newDesc = ref('')
const newCat = ref('')
const pendingTrack = ref<Track | null>(null)

onMounted(() => {
  if (route.query.category) {
    activeCategory.value = route.query.category as string
  }
})

const filteredFolders = computed(() => {
  if (!activeCategory.value) return store.folders
  return store.folders.filter(f => f.category === activeCategory.value)
})

function handleClearAll() {
  if (confirm('确定清空播放列表？')) {
    player.clearPlaylist()
  }
}

function handleDeleteFolder(id: string) {
  if (confirm('确定删除该歌单？')) {
    store.deleteFolder(id)
  }
}

function playAllFolder(folderId: string) {
  const folder = store.folders.find(f => f.id === folderId)
  if (folder && folder.tracks.length > 0) {
    player.setPlaylist([...folder.tracks])
    player.playTrack(0)
  }
}

function showAddToFolder(track: Track) {
  pendingTrack.value = track
  showFolderPicker.value = true
}

function doAddToFolder(folderId: string) {
  if (pendingTrack.value) {
    store.addTrackToFolder(folderId, pendingTrack.value)
  }
  showFolderPicker.value = false
  pendingTrack.value = null
}

function doCreate() {
  if (!newName.value.trim()) return
  store.createFolder(newName.value.trim(), newDesc.value.trim() || undefined, newCat.value || undefined)
  newName.value = ''
  newDesc.value = ''
  newCat.value = ''
  showCreate.value = false
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
]

function getGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}
</script>

<style scoped>
.playlist-view {
  padding: 24px;
  max-width: 1000px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.action-btn.primary {
  background: var(--accent);
  color: #fff;
}

.action-btn.primary:hover {
  background: var(--accent-hover);
}

.small-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-xs);
  font-size: 12px;
  color: var(--accent);
  border: 1px solid var(--border-accent);
  transition: all var(--transition-fast);
}

.small-btn:hover {
  background: var(--accent-subtle);
}

/* Category tabs */
.category-tabs {
  display: flex;
  gap: 6px;
  padding: 0 0 16px;
  overflow-x: auto;
  flex-wrap: wrap;
}

.tab-item {
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-item.active {
  background: var(--accent);
  color: #fff;
}

/* Section */
.section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
}

.count {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 400;
}

/* Folder list */
.folder-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.folder-item:hover {
  background: var(--bg-hover);
}

.folder-left {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.folder-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.folder-meta {
  flex: 1;
  min-width: 0;
}

.folder-name {
  font-size: 14px;
  font-weight: 500;
}

.folder-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.folder-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.folder-item:hover .folder-actions {
  opacity: 1;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

/* Track list */
.track-list {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.col-num { width: 36px; text-align: center; flex-shrink: 0; }
.col-title { flex: 2; min-width: 0; }
.col-artist { flex: 1.5; min-width: 0; color: var(--text-muted); }
.col-album { flex: 1.5; min-width: 0; color: var(--text-muted); }
.col-duration { width: 52px; text-align: right; flex-shrink: 0; }
.col-actions { width: 64px; flex-shrink: 0; }

.list-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.list-row:hover {
  background: var(--bg-hover);
}

.list-row.active {
  background: var(--accent-subtle);
}

.list-row.active .col-title {
  color: var(--accent);
}

.list-row .col-num {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.list-row .col-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fav-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.fav-icon:hover,
.fav-icon.active {
  color: var(--accent-secondary);
}

.list-row .col-artist,
.list-row .col-album {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-row .col-duration {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.list-row .col-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.list-row:hover .col-actions {
  opacity: 1;
}

/* Playing indicator */
.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.playing-indicator span {
  display: block;
  width: 2px;
  background: var(--accent);
  border-radius: 1px;
  animation: bar-bounce 0.8s ease-in-out infinite;
}

.playing-indicator span:nth-child(1) { height: 60%; animation-delay: 0s; }
.playing-indicator span:nth-child(2) { height: 100%; animation-delay: 0.2s; }
.playing-indicator span:nth-child(3) { height: 40%; animation-delay: 0.4s; }

@keyframes bar-bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* Transition */
.list-enter-active { transition: all 0.3s ease; }
.list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateX(-20px); }
.list-leave-to { opacity: 0; transform: translateX(20px); }

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 14px;
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
  width: 380px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-box h3 {
  font-size: 16px;
  font-weight: 600;
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

.modal-btns button:hover { background: var(--bg-hover); }
.modal-btns button.primary { background: var(--accent); color: #fff; }
.modal-btns button.primary:hover:not(:disabled) { background: var(--accent-hover); }
.modal-btns button.primary:disabled { opacity: 0.4; cursor: not-allowed; }

.folder-picker-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: 13px;
}

.picker-item:hover {
  background: var(--bg-hover);
}

.picker-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.picker-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 12px;
  text-align: center;
}

@media (max-width: 768px) {
  .playlist-view { padding: 16px; }
  .col-album { display: none; }
  .list-header .col-album { display: none; }
  .folder-actions { opacity: 1; }
  .col-actions { opacity: 1; }
}
</style>
