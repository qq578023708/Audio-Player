<template>
  <div
    class="track-item"
    :class="{ active: isActive, playing: isActive && player.isPlaying.value }"
    @dblclick="player.playTrack(index)"
  >
    <div class="track-index">
      <template v-if="isActive && player.isPlaying.value">
        <div class="playing-indicator">
          <span /><span /><span />
        </div>
      </template>
      <template v-else-if="isActive && player.isLoading.value">
        <SvgIcon name="loader" :size="14" class="spinning" />
      </template>
      <template v-else>
        {{ String(index + 1).padStart(2, '0') }}
      </template>
    </div>

    <div class="track-info">
      <div class="track-title" :title="track.title">{{ track.title }}</div>
      <div class="track-artist" :title="track.artist">{{ track.artist }}</div>
    </div>

    <div class="track-album" v-if="track.album" :title="track.album">
      {{ track.album }}
    </div>

    <div class="track-duration" v-if="track.duration">
      {{ formatTime(track.duration) }}
    </div>

    <div class="track-actions">
      <button class="action-btn" title="播放" @click.stop="player.playTrack(index)">
        <SvgIcon :name="isActive && player.isPlaying.value ? 'pause' : 'play'" :size="16" />
      </button>
      <button class="action-btn danger" title="移除" @click.stop="removeTrack(index)">
        <SvgIcon name="x" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Track } from '@/types'
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { computed } from 'vue'

const props = defineProps<{
  track: Track
  index: number
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()

const player = useAudioPlayer()

const isActive = computed(() => player.currentTrack.value?.id === props.track.id)

function removeTrack(index: number) {
  emit('remove', index)
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.track-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  position: relative;
}

.track-item:hover {
  background: var(--bg-hover);
}

.track-item.active {
  background: var(--accent-subtle);
}

.track-item.active .track-title {
  color: var(--accent);
}

.track-index {
  width: 32px;
  text-align: center;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  flex-shrink: 0;
}

.track-item.active .track-index {
  color: var(--accent);
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-duration {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  flex-shrink: 0;
}

.track-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.track-item:hover .track-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

/* Playing indicator animation */
.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.playing-indicator span {
  display: block;
  width: 3px;
  background: var(--accent);
  border-radius: 1px;
  animation: bar-bounce 0.8s ease-in-out infinite;
}

.playing-indicator span:nth-child(1) {
  height: 60%;
  animation-delay: 0s;
}

.playing-indicator span:nth-child(2) {
  height: 100%;
  animation-delay: 0.2s;
}

.playing-indicator span:nth-child(3) {
  height: 40%;
  animation-delay: 0.4s;
}

@keyframes bar-bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .track-album {
    display: none;
  }
  .track-actions {
    opacity: 1;
  }
}
</style>
