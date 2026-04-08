<template>
  <div class="history-view">
    <div class="page-header">
      <h1 class="page-title">
        <SvgIcon name="clock" :size="22" />
        播放历史
        <span class="count" v-if="store.history.length">({{ store.history.length }})</span>
      </h1>
      <button class="action-btn danger" @click="handleClear" v-if="store.history.length > 0">
        <SvgIcon name="trash" :size="14" />
        清空
      </button>
    </div>

    <div class="track-list" v-if="store.history.length > 0">
      <div
        v-for="(track, index) in store.history"
        :key="`${track.id}_${index}`"
        class="track-row"
        :class="{ active: player.currentTrack.value?.id === track.id }"
        @dblclick="player.playUrl(track.url, track.title, track.artist, track.cover)"
      >
        <span class="row-num">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="row-title">
          <SvgIcon
            :name="player.currentTrack.value?.id === track.id && player.isPlaying.value ? 'volume-high' : 'music'"
            :size="14"
            :class="{ playing: player.currentTrack.value?.id === track.id && player.isPlaying.value }"
          />
          {{ track.title }}
        </span>
        <span class="row-artist">{{ track.artist }}</span>
        <span class="row-album" v-if="track.album">{{ track.album }}</span>
        <span class="row-actions">
          <button class="icon-btn" title="收藏" @click.stop="store.toggleFavorite(track)">
            <SvgIcon :name="store.isFavorite(track.id) ? 'heart-filled' : 'heart'" :size="14" />
          </button>
        </span>
      </div>
    </div>

    <div class="empty-state" v-else>
      <SvgIcon name="clock" :size="48" />
      <p>暂无播放历史</p>
      <p class="hint">播放音乐后将自动记录</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'

defineOptions({
  name: 'history'
})

const player = useAudioPlayer()
const store = usePlaylistStore()

function handleClear() {
  if (confirm('确定清空播放历史？')) {
    store.clearHistory()
  }
}
</script>

<style scoped>
.history-view {
  padding: 24px;
  max-width: 900px;
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

.count {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 400;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.action-btn.danger:hover {
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

.track-row.active .row-title {
  color: var(--accent);
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
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 2;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-title svg {
  flex-shrink: 0;
  color: var(--text-muted);
}

.row-title svg.playing {
  color: var(--accent);
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
  color: var(--accent-secondary);
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

@media (max-width: 768px) {
  .history-view { padding: 16px; }
  .row-album { display: none; }
  .row-actions { opacity: 1; }
}
</style>
