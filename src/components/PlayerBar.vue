<template>
  <div class="player-bar">
    <!-- Left: Track info -->
    <div class="bar-left" v-if="player.currentTrack.value">
      <div class="bar-cover" @click="toggleLyrics">
        <img v-if="player.currentTrack.value.cover" :src="player.currentTrack.value.cover" alt="" />
        <SvgIcon v-else name="disc" :size="18" :class="{ spinning: player.isPlaying.value }" />
      </div>
      <div class="bar-info">
        <div class="bar-title" :title="player.currentTrack.value.title">
          {{ player.currentTrack.value.title }}
        </div>
        <div class="bar-artist" :title="player.currentTrack.value.artist">
          {{ player.currentTrack.value.artist }}
        </div>
        <transition name="fade">
          <div class="bar-status" v-if="statusText" :class="{ 'is-error': player.error.value }">
            {{ statusText }}
          </div>
        </transition>
      </div>
      <button class="bar-fav-btn" @click="handleFavorite" :class="{ favorited: isFav }">
        <SvgIcon :name="isFav ? 'heart-filled' : 'heart'" :size="16" />
      </button>
    </div>
    <div class="bar-left" v-else>
      <div class="bar-cover placeholder">
        <SvgIcon name="music" :size="18" />
      </div>
      <div class="bar-info">
        <div class="bar-title muted">未在播放</div>
      </div>
    </div>

    <!-- Center: Controls + Progress -->
    <div class="bar-center">
      <transition name="fade">
        <div class="bar-error-hint" v-if="player.error.value" @click="player.error.value = null">
          <SvgIcon name="alert-circle" :size="12" />
          <span>{{ player.error.value }}</span>
        </div>
      </transition>
      <div class="bar-controls">
        <button class="bar-ctrl" title="播放模式" @click="player.cyclePlayMode()">
          <SvgIcon
            :name="playModeIcon"
            :size="16"
            :class="{ active: player.playMode.value !== 'sequence' }"
          />
        </button>
        <button class="bar-ctrl" title="上一曲" @click="player.playPrev()" :disabled="!player.hasTrack.value">
          <SvgIcon name="skip-back" :size="18" />
        </button>
        <button class="bar-play-btn" @click="player.togglePlay()">
          <SvgIcon v-if="player.isLoading.value" name="loader" :size="22" class="spinning" />
          <SvgIcon v-else-if="player.isPlaying.value" name="pause" :size="22" />
          <SvgIcon v-else name="play" :size="22" />
        </button>
        <button class="bar-ctrl" title="下一曲" @click="player.playNext()" :disabled="!player.hasTrack.value">
          <SvgIcon name="skip-forward" :size="18" />
        </button>
        <button class="bar-ctrl" title="播放列表" @click="togglePlaylist">
          <SvgIcon name="playlist" :size="16" />
        </button>
      </div>
      <div class="bar-progress">
        <span class="bar-time">{{ player.formattedCurrentTime.value }}</span>
        <div class="progress-track" ref="progressRef" @mousedown="onProgressDown" @touchstart="onProgressTouch">
          <div class="progress-fill" :style="{ width: `${player.progress.value * 100}%` }" />
        </div>
        <span class="bar-time">{{ player.formattedDuration.value }}</span>
      </div>
    </div>

    <!-- Right: Volume + EQ -->
    <div class="bar-right">
      <button class="bar-ctrl" :title="player.isMuted.value ? '取消静音' : '静音'" @click="player.toggleMute()">
        <SvgIcon
          :name="volumeIcon"
          :size="16"
        />
      </button>
      <div class="volume-wrap">
        <input
          type="range"
          class="volume-slider"
          min="0"
          max="100"
          :value="player.isMuted.value ? 0 : Math.round(player.volume.value * 100)"
          @input="(e) => player.setVolume(Number((e.target as HTMLInputElement).value) / 100)"
        />
      </div>
      <button class="bar-ctrl eq-btn" :class="{ active: showEQ }" title="均衡器" @click="toggleEQ">
        <SvgIcon name="settings" :size="16" />
      </button>
    </div>

    <!-- EQ Panel overlay -->
    <Teleport to="body">
      <transition name="slide-up">
        <div class="eq-overlay" v-if="showEQ" @click.self="showEQ = false">
          <div class="eq-popup">
            <EqualizerPanel />
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import EqualizerPanel from './EqualizerPanel.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'
import { useRouter } from 'vue-router'

const player = useAudioPlayer()
const store = usePlaylistStore()
const router = useRouter()
const progressRef = ref<HTMLElement | null>(null)
const showEQ = ref(false)

const emit = defineEmits<{
  togglePlaylist: []
}>()

const isFav = computed(() => {
  if (!player.currentTrack.value) return false
  return store.isFavorite(player.currentTrack.value.id)
})

const statusText = computed(() => {
  if (player.error.value) return null // errors handled separately below
  if (player.isResolving.value) return player.resolveStatus.value || '正在解析...'
  if (player.isLoading.value) return '加载中...'
  if (player.resolveStatus.value) return player.resolveStatus.value
  return null
})

function handleFavorite() {
  if (player.currentTrack.value) {
    store.toggleFavorite(player.currentTrack.value)
  }
}

const playModeIcon = computed(() => {
  switch (player.playMode.value) {
    case 'loop': return 'repeat'
    case 'shuffle': return 'shuffle'
    case 'single': return 'repeat-one'
    default: return 'repeat'
  }
})

const volumeIcon = computed(() => {
  if (player.isMuted.value || player.volume.value === 0) return 'volume-x'
  if (player.volume.value < 0.5) return 'volume-low'
  return 'volume-high'
})

function togglePlaylist() {
  emit('togglePlaylist')
}

function toggleLyrics() {
  router.push('/now-playing')
}

function toggleEQ() {
  showEQ.value = !showEQ.value
}

function getProgressPercent(e: MouseEvent | Touch): number {
  if (!progressRef.value) return 0
  const rect = progressRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

function onProgressDown(e: MouseEvent) {
  player.seekByPercent(getProgressPercent(e))
  const onMove = (ev: MouseEvent) => player.seekByPercent(getProgressPercent(ev))
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onProgressTouch(e: TouchEvent) {
  if (!e.touches.length) return
  player.seekByPercent(getProgressPercent(e.touches[0]))
  const onMove = (ev: TouchEvent) => {
    if (ev.touches.length) player.seekByPercent(getProgressPercent(ev.touches[0]))
  }
  const onEnd = () => {
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  }
  document.addEventListener('touchmove', onMove)
  document.addEventListener('touchend', onEnd)
}
</script>

<style scoped>
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--player-bar-height);
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  z-index: 100;
  gap: 16px;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  max-width: 280px;
  flex: 0 0 auto;
}

.bar-cover {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-muted);
  cursor: pointer;
}

.bar-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bar-cover.placeholder {
  border: 1px dashed var(--border-light);
}

.bar-info {
  flex: 1;
  min-width: 0;
}

.bar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-title.muted {
  color: var(--text-muted);
}

.bar-artist {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.bar-status {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
  opacity: 0.8;
}

.bar-status.is-error {
  color: var(--danger, #e74c3c);
}

.bar-fav-btn {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--transition-fast);
}

.bar-fav-btn:hover,
.bar-fav-btn.favorited {
  color: var(--accent-secondary);
}

/* Center controls */
.bar-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 600px;
  margin: 0 auto;
}

.bar-error-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--danger, #e74c3c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  cursor: pointer;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: rgba(231, 76, 60, 0.08);
}

.bar-error-hint:hover {
  background: rgba(231, 76, 60, 0.15);
}

.bar-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-ctrl {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.bar-ctrl:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.bar-ctrl.active {
  color: var(--accent);
}

.bar-ctrl:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.bar-play-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
}

.bar-play-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.05);
}

/* Progress */
.bar-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-track {
  flex: 1;
  height: 3px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}

.progress-track:hover {
  height: 5px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.bar-time {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 32px;
  text-align: center;
  flex-shrink: 0;
}

/* Right volume */
.bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.volume-wrap {
  width: 80px;
}

.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .bar-left {
    min-width: 120px;
    max-width: 160px;
  }
  .bar-artist {
    display: none;
  }
  .bar-right {
    display: none;
  }
  .bar-center {
    flex: 1;
  }
}

/* EQ button */
.eq-btn.active {
  color: var(--accent);
}

/* EQ Panel */
.eq-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.eq-popup {
  width: 380px;
  max-width: 95vw;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
