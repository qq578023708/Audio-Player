<template>
  <div class="player-controls">
    <div class="controls-left">
      <button class="ctrl-btn" title="随机播放" @click="player.cyclePlayMode()">
        <SvgIcon
          :name="playModeIcon"
          :size="20"
          :class="{ active: player.playMode.value !== 'sequence' }"
        />
      </button>
    </div>

    <div class="controls-center">
      <button class="ctrl-btn" title="上一曲" @click="player.playPrev()" :disabled="!player.hasTrack.value">
        <SvgIcon name="skip-back" :size="22" />
      </button>

      <button class="play-btn" :class="{ playing: player.isPlaying.value }" @click="player.togglePlay()">
        <SvgIcon v-if="player.isLoading.value" name="loader" :size="24" class="spinning" />
        <SvgIcon v-else-if="player.isPlaying.value" name="pause" :size="26" />
        <SvgIcon v-else name="play" :size="26" />
      </button>

      <button class="ctrl-btn" title="下一曲" @click="player.playNext()" :disabled="!player.hasTrack.value">
        <SvgIcon name="skip-forward" :size="22" />
      </button>
    </div>

    <div class="controls-right">
      <button
        class="ctrl-btn volume-btn"
        :title="player.isMuted.value ? '取消静音' : '静音'"
        @click="player.toggleMute()"
      >
        <SvgIcon
          :name="volumeIcon"
          :size="20"
        />
      </button>
      <div class="volume-slider-wrap">
        <input
          type="range"
          class="volume-slider"
          min="0"
          max="100"
          :value="player.isMuted.value ? 0 : Math.round(player.volume.value * 100)"
          @input="(e) => player.setVolume(Number((e.target as HTMLInputElement).value) / 100)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()

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
</script>

<style scoped>
.player-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 600px;
  padding: 0 8px;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}

.controls-right {
  justify-content: flex-end;
}

.controls-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ctrl-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.ctrl-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.ctrl-btn.active {
  color: var(--accent);
}

.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-md);
}

.play-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.05);
  box-shadow: var(--shadow-glow);
}

.play-btn:active {
  transform: scale(0.95);
}

.volume-btn {
  width: 32px;
  height: 32px;
}

.volume-slider-wrap {
  width: 80px;
}

.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
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
  .controls-left {
    min-width: auto;
  }
  .controls-right {
    min-width: auto;
  }
  .volume-slider-wrap {
    width: 60px;
  }
}
</style>
