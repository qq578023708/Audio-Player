<template>
  <div class="now-playing-view">
    <div class="np-bg" :style="bgStyle">
      <ParticleBackground />
    </div>

    <div class="np-content" v-if="player.currentTrack.value">
      <!-- Album art -->
      <div class="np-cover-area">
        <div class="np-disc" :class="{ spinning: player.isPlaying.value }">
          <div class="np-disc-inner" :style="coverStyle">
            <img v-if="player.currentTrack.value.cover" :src="player.currentTrack.value.cover" alt="" />
            <SvgIcon v-else name="disc" :size="40" />
          </div>
        </div>
      </div>

      <!-- Track info -->
      <div class="np-info">
        <h2 class="np-title">{{ player.currentTrack.value.title }}</h2>
        <p class="np-artist">{{ player.currentTrack.value.artist }}</p>
        <p class="np-album" v-if="player.currentTrack.value.album">{{ player.currentTrack.value.album }}</p>
      </div>

      <!-- Controls -->
      <div class="np-controls">
        <button class="ctrl-btn" @click="player.cyclePlayMode()">
          <SvgIcon :name="playModeIcon" :size="20" :class="{ active: player.playMode.value !== 'sequence' }" />
        </button>
        <button class="ctrl-btn" @click="player.playPrev()">
          <SvgIcon name="skip-back" :size="22" />
        </button>
        <button class="play-btn" @click="player.togglePlay()">
          <SvgIcon v-if="player.isLoading.value" name="loader" :size="26" class="spinning" />
          <SvgIcon v-else-if="player.isPlaying.value" name="pause" :size="28" />
          <SvgIcon v-else name="play" :size="28" />
        </button>
        <button class="ctrl-btn" @click="player.playNext()">
          <SvgIcon name="skip-forward" :size="22" />
        </button>
        <button class="ctrl-btn" @click="toggleLyricsMode">
          <SvgIcon name="music" :size="20" :class="{ active: showLyrics }" />
        </button>
      </div>

      <!-- Progress -->
      <div class="np-progress">
        <span class="np-time">{{ player.formattedCurrentTime.value }}</span>
        <div class="np-progress-track" ref="progressRef" @mousedown="onProgressDown">
          <div class="np-progress-fill" :style="{ width: `${player.progress.value * 100}%` }" />
        </div>
        <span class="np-time">{{ player.formattedDuration.value }}</span>
      </div>

      <!-- Audio visualizer -->
      <div class="np-visualizer">
        <AudioVisualizer :bar-count="40" :is-playing="player.isPlaying.value" :height="48" />
      </div>

      <!-- Lyrics -->
      <transition name="slide-up">
        <div class="np-lyrics" v-if="showLyrics">
          <LyricsPanel :track="player.currentTrack.value" :show-header="false" />
        </div>
      </transition>
    </div>

    <div class="np-empty" v-else>
      <SvgIcon name="music" :size="48" />
      <p>选择一首歌曲开始播放</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import ParticleBackground from '@/components/ParticleBackground.vue'
import AudioVisualizer from '@/components/AudioVisualizer.vue'
import LyricsPanel from '@/components/LyricsPanel.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()
const showLyrics = ref(true)
const progressRef = ref<HTMLElement | null>(null)

const playModeIcon = computed(() => {
  switch (player.playMode.value) {
    case 'loop': return 'repeat'
    case 'shuffle': return 'shuffle'
    case 'single': return 'repeat-one'
    default: return 'repeat'
  }
})

const coverStyle = computed(() => {
  const cover = player.currentTrack.value?.cover
  if (cover) return { backgroundImage: `url(${cover})` }
  return {}
})

const bgStyle = computed(() => {
  const cover = player.currentTrack.value?.cover
  if (cover) return { backgroundImage: `url(${cover})` }
  return {}
})

function toggleLyricsMode() {
  showLyrics.value = !showLyrics.value
}

function onProgressDown(e: MouseEvent) {
  if (!progressRef.value) return
  const rect = progressRef.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seekByPercent(percent)

  const onMove = (ev: MouseEvent) => {
    const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
    player.seekByPercent(p)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.now-playing-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.np-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(40px) brightness(0.3);
  transform: scale(1.2);
  z-index: 0;
}

.np-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32px;
  gap: 20px;
  overflow-y: auto;
}

.np-cover-area {
  margin-bottom: 8px;
}

.np-disc {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 3px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  transition: transform var(--transition-normal);
}

.np-disc.spinning {
  animation: disc-spin 8s linear infinite;
}

.np-disc-inner {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  color: var(--text-muted);
}

.np-disc-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@keyframes disc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.np-info {
  text-align: center;
  max-width: 400px;
}

.np-title {
  font-size: 20px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.np-artist {
  font-size: 15px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.np-album {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.np-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 8px;
}

.ctrl-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.ctrl-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.ctrl-btn.active {
  color: var(--accent);
}

.play-btn {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.play-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.05);
}

.np-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 400px;
}

.np-time {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 36px;
  text-align: center;
}

.np-progress-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.np-progress-track:hover {
  height: 6px;
}

.np-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.np-visualizer {
  margin-top: 4px;
  width: 50%;
  max-width: 250px;
}

.np-lyrics {
  width: 100%;
  max-width: 500px;
  min-height: 260px;
  max-height: 320px;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.np-empty {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Slide up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.35s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
  max-height: 0;
}

@media (max-width: 768px) {
  .np-disc {
    width: 160px;
    height: 160px;
  }
  .np-disc-inner {
    width: 144px;
    height: 144px;
  }
  .np-title { font-size: 18px; }
  .np-controls { gap: 16px; }
  .ctrl-btn { width: 36px; height: 36px; }
  .play-btn { width: 48px; height: 48px; }
}
</style>
