<template>
  <div class="folder-detail-view" v-if="folder">
    <div class="page-header">
      <div class="header-info">
        <button class="back-btn" @click="$router.push('/playlist')">
          <SvgIcon name="chevron-right" :size="18" style="transform: rotate(180deg)" />
        </button>
        <div class="folder-cover" :style="{ background: getGradient(folder.id) }">
          <SvgIcon name="folder" :size="28" />
        </div>
        <div class="header-text">
          <h1 class="folder-name">{{ folder.name }}</h1>
          <div class="folder-meta">
            {{ folder.tracks.length }} 首歌曲
            <span v-if="folder.description"> · {{ folder.description }}</span>
            <span v-if="categoryName"> · {{ categoryName }}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="playAll" :disabled="folder.tracks.length === 0">
          <SvgIcon name="play" :size="14" />
          播放全部
        </button>
        <button class="icon-btn" title="编辑" @click="showEdit = true">
          <SvgIcon name="edit" :size="16" />
        </button>
        <button class="icon-btn danger" title="删除歌单" @click="handleDelete">
          <SvgIcon name="trash" :size="14" />
        </button>
      </div>
    </div>

    <div class="track-list" v-if="folder.tracks.length > 0">
      <div
        v-for="(track, index) in folder.tracks"
        :key="track.id"
        class="track-row"
        :class="{ active: player.currentTrack.value?.id === track.id }"
        @dblclick="playTrackFromFolder(index)"
      >
        <span class="row-num">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="row-title">{{ track.title }}</span>
        <span class="row-artist">{{ track.artist }}</span>
        <span class="row-album" v-if="track.album">{{ track.album }}</span>
        <span class="row-actions">
          <button class="icon-btn" title="收藏" @click.stop="store.toggleFavorite(track)">
            <SvgIcon :name="store.isFavorite(track.id) ? 'heart-filled' : 'heart'" :size="14" />
          </button>
          <button class="icon-btn danger" title="移除" @click.stop="store.removeTrackFromFolder(folder.id, index)">
            <SvgIcon name="x" :size="14" />
          </button>
        </span>
      </div>
    </div>

    <div class="empty-state" v-else>
      <SvgIcon name="music" :size="40" />
      <p>歌单为空</p>
      <p class="hint">在播放列表中点击 + 将歌曲添加到此歌单</p>
    </div>

    <!-- Edit dialog -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showEdit" @click.self="showEdit = false">
        <div class="modal-box">
          <h3>编辑歌单</h3>
          <input v-model="editName" placeholder="歌单名称" />
          <input v-model="editDesc" placeholder="描述（可选）" />
          <select v-model="editCat">
            <option value="">未分类</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <div class="modal-btns">
            <button @click="showEdit = false">取消</button>
            <button class="primary" @click="doEdit">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const player = useAudioPlayer()
const store = usePlaylistStore()

const showEdit = ref(false)
const editName = ref('')
const editDesc = ref('')
const editCat = ref('')

const folder = computed(() => store.folders.find(f => f.id === props.id))

const categoryName = computed(() => {
  if (!folder.value?.category) return ''
  const cat = store.categories.find(c => c.id === folder.value!.category)
  return cat?.name || ''
})

watch(showEdit, (val) => {
  if (val && folder.value) {
    editName.value = folder.value.name
    editDesc.value = folder.value.description || ''
    editCat.value = folder.value.category || ''
  }
})

function playAll() {
  if (!folder.value) return
  player.setPlaylist([...folder.value.tracks])
  player.playTrack(0)
}

function playTrackFromFolder(index: number) {
  if (!folder.value) return
  player.setPlaylist([...folder.value.tracks])
  player.playTrack(index)
}

function handleDelete() {
  if (confirm('确定删除该歌单？')) {
    store.deleteFolder(props.id)
    router.push('/playlist')
  }
}

function doEdit() {
  store.updateFolder(props.id, {
    name: editName.value.trim() || undefined,
    description: editDesc.value.trim() || undefined,
    category: editCat.value || undefined
  })
  showEdit.value = false
}

const gradients = [
  'linear-gradient(135deg, #ff6a00, #ff2d55)',
  'linear-gradient(135deg, #5b8cff, #8b5cf6)',
  'linear-gradient(135deg, #30d158, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
]

function getGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}
</script>

<style scoped>
.folder-detail-view {
  padding: 24px;
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.folder-cover {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.folder-name {
  font-size: 20px;
  font-weight: 700;
}

.folder-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.track-list {
  display: flex;
  flex-direction: column;
}

.track-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.track-row:hover {
  background: var(--bg-hover);
}

.track-row.active {
  background: var(--accent-subtle);
}

.row-num {
  width: 32px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: center;
  flex-shrink: 0;
}

.row-title {
  flex: 2;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-artist {
  flex: 1.5;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-album {
  flex: 1;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.track-row:hover .row-actions {
  opacity: 1;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-muted);
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--text-muted);
}

.empty-state p { font-size: 14px; }
.empty-state .hint { font-size: 12px; opacity: 0.6; }

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
.modal-btns button.primary:hover { background: var(--accent-hover); }

@media (max-width: 768px) {
  .folder-detail-view { padding: 16px; }
  .row-album { display: none; }
  .row-actions { opacity: 1; }
  .header-info { flex-wrap: wrap; }
}
</style>
