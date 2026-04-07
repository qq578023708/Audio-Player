<template>
  <div class="add-url-view">
    <div class="page-header">
      <h1 class="page-title">
        <SvgIcon name="link" :size="22" />
        添加音乐
      </h1>
    </div>

    <div class="url-card">
      <div class="url-input-wrap">
        <SvgIcon name="link" :size="18" />
        <input
          v-model="url"
          type="text"
          placeholder="输入音频 URL（支持 mp3, m4a, ogg, flac, wav...）"
          @keydown.enter="handleAdd"
        />
        <button class="add-btn" @click="handleAdd" :disabled="!url.trim()">
          <SvgIcon name="plus" :size="16" />
          添加并播放
        </button>
      </div>
      <div v-if="localError" class="error-msg">
        {{ localError }}
      </div>
      <div v-if="successMsg" class="success-msg">
        {{ successMsg }}
      </div>
    </div>

    <!-- Quick options -->
    <div class="quick-section">
      <h3>快速添加到歌单</h3>
      <div class="folder-chips" v-if="store.folders.length > 0">
        <button
          v-for="folder in store.folders"
          :key="folder.id"
          class="chip"
          :class="{ active: selectedFolder === folder.id }"
          @click="selectedFolder = selectedFolder === folder.id ? '' : folder.id"
        >
          <SvgIcon name="folder" :size="12" />
          {{ folder.name }}
        </button>
      </div>
      <p v-else class="no-folder">暂无歌单，添加的歌曲将进入播放队列</p>
    </div>

    <!-- Batch input -->
    <div class="batch-section">
      <h3>批量添加</h3>
      <p class="hint">每行一个 URL，格式：URL | 标题 | 歌手</p>
      <textarea
        v-model="batchInput"
        placeholder="https://example.com/song1.mp3 | 歌曲名1 | 歌手名1&#10;https://example.com/song2.mp3 | 歌曲名2 | 歌手名2"
        rows="6"
        class="batch-textarea"
      ></textarea>
      <button class="batch-btn" @click="handleBatchAdd" :disabled="!batchInput.trim()">
        <SvgIcon name="plus" :size="14" />
        批量添加 ({{ batchLines }} 首)
      </button>
    </div>

    <!-- Demo tracks -->
    <div class="demo-section">
      <h3>试听示例</h3>
      <div class="demo-list">
        <div
          v-for="(track, i) in demoTracks"
          :key="i"
          class="demo-item"
          @click="player.playUrl(track.url, track.title, track.artist)"
        >
          <div class="demo-cover" :style="{ background: demoGradients[i] }">
            <SvgIcon name="play" :size="20" class="play-icon" />
          </div>
          <div class="demo-info">
            <div class="demo-title">{{ track.title }}</div>
            <div class="demo-artist">{{ track.artist }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'

const player = useAudioPlayer()
const store = usePlaylistStore()

const url = ref('')
const localError = ref('')
const successMsg = ref('')
const selectedFolder = ref('')
const batchInput = ref('')

const batchLines = computed(() => {
  if (!batchInput.value.trim()) return 0
  return batchInput.value.trim().split('\n').filter(l => l.trim()).length
})

function handleAdd() {
  const trimmed = url.value.trim()
  if (!trimmed) return
  localError.value = ''

  try {
    new URL(trimmed)
    doAdd(trimmed)
  } catch {
    try {
      const fullUrl = 'https://' + trimmed
      new URL(fullUrl)
      doAdd(fullUrl)
    } catch {
      localError.value = '请输入有效的 URL 地址'
    }
  }
}

function doAdd(finalUrl: string) {
  player.playUrl(finalUrl)

  if (selectedFolder.value && player.currentTrack.value) {
    store.addTrackToFolder(selectedFolder.value, player.currentTrack.value)
  }

  successMsg.value = '已添加到播放队列'
  setTimeout(() => { successMsg.value = '' }, 2000)
  url.value = ''
}

function handleBatchAdd() {
  const lines = batchInput.value.trim().split('\n').filter(l => l.trim())
  let count = 0

  for (const line of lines) {
    const parts = line.split('|').map(s => s.trim())
    const trackUrl = parts[0]
    const title = parts[1] || ''
    const artist = parts[2] || ''

    if (!trackUrl) continue

    try {
      new URL(trackUrl.startsWith('http') ? trackUrl : 'https://' + trackUrl)
      const finalUrl = trackUrl.startsWith('http') ? trackUrl : 'https://' + trackUrl

      if (title || artist) {
        player.addToPlaylist({
          id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: title || new URL(finalUrl).pathname.split('/').pop() || '未知',
          artist: artist || '未知',
          url: finalUrl,
        })
      } else {
        player.addToPlaylist({
          id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: new URL(finalUrl).pathname.split('/').pop() || '未知',
          artist: '未知',
          url: finalUrl,
        })
      }
      count++
    } catch {
      // skip invalid URLs
    }
  }

  if (count > 0) {
    successMsg.value = `成功添加 ${count} 首歌曲`
    setTimeout(() => { successMsg.value = '' }, 3000)
    batchInput.value = ''
  }
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
.add-url-view {
  padding: 24px;
  max-width: 700px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
}

.url-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 24px;
}

.url-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 4px 4px 4px 14px;
  transition: all var(--transition-fast);
}

.url-input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.url-input-wrap svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.url-input-wrap input {
  flex: 1;
  min-width: 0;
  padding: 10px 4px;
  font-size: 14px;
}

.url-input-wrap input::placeholder {
  color: var(--text-muted);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.add-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 10px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
}

.success-msg {
  margin-top: 10px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--success);
  background: rgba(48, 209, 88, 0.1);
  border-radius: var(--radius-sm);
}

/* Quick section */
.quick-section,
.batch-section,
.demo-section {
  margin-bottom: 24px;
}

.quick-section h3,
.batch-section h3,
.demo-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.folder-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--border-light);
  background: var(--bg-hover);
}

.chip.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.no-folder {
  font-size: 13px;
  color: var(--text-muted);
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.batch-textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 100px;
}

.batch-textarea:focus {
  border-color: var(--accent);
}

.batch-textarea::placeholder {
  color: var(--text-muted);
}

.batch-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  margin-top: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.batch-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.batch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Demo */
.demo-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.demo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.demo-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.demo-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.play-icon {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.demo-item:hover .play-icon {
  opacity: 1;
}

.demo-info {
  flex: 1;
  min-width: 0;
}

.demo-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.demo-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

@media (max-width: 768px) {
  .add-url-view { padding: 16px; }
  .url-input-wrap { flex-wrap: wrap; }
  .add-btn { width: 100%; justify-content: center; }
}
</style>
