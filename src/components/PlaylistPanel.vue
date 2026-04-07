<template>
  <div class="playlist-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <SvgIcon name="list-music" :size="18" />
        <span>播放列表</span>
        <span class="track-count" v-if="player.playlist.value.length">({{ player.playlist.value.length }})</span>
      </h3>
      <div class="panel-actions">
        <button class="header-btn" title="清空列表" @click="handleClear" v-if="player.playlist.value.length > 0">
          <SvgIcon name="trash" :size="16" />
        </button>
      </div>
    </div>

    <div class="playlist-content" v-if="player.playlist.value.length > 0">
      <TransitionGroup name="list" tag="div" class="track-list">
        <TrackItem
          v-for="(track, index) in player.playlist.value"
          :key="track.id"
          :track="track"
          :index="index"
          @remove="handleRemove"
        />
      </TransitionGroup>
    </div>

    <div class="empty-state" v-else>
      <SvgIcon name="music" :size="48" />
      <p>播放列表为空</p>
      <p class="hint">在上方输入音频 URL 开始收听</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import TrackItem from './TrackItem.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()

function handleRemove(index: number) {
  player.removeFromPlaylist(index)
}

function handleClear() {
  player.clearPlaylist()
}
</script>

<style scoped>
.playlist-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.track-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--danger);
}

.playlist-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.track-list {
  display: flex;
  flex-direction: column;
}

/* Transition group animations */
.list-enter-active {
  transition: all var(--transition-normal);
}

.list-leave-active {
  transition: all var(--transition-fast);
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 14px;
}

.empty-state .hint {
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.6;
}
</style>
