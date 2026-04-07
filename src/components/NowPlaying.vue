<template>
  <div class="now-playing">
    <div class="cover-area" v-if="player.currentTrack.value?.cover">
      <img :src="player.currentTrack.value.cover" :alt="player.currentTrack.value.title" class="cover-img" />
    </div>
    <div class="cover-placeholder" v-else>
      <SvgIcon name="disc" :size="60" :class="{ spinning: player.isPlaying.value }" />
    </div>

    <div class="track-info">
      <div class="track-title" :title="player.currentTrack.value?.title">
        {{ player.currentTrack.value?.title || '未在播放' }}
      </div>
      <div class="track-artist" :title="player.currentTrack.value?.artist">
        {{ player.currentTrack.value?.artist || '' }}
      </div>
    </div>

    <div class="loading-overlay" v-if="player.isLoading.value">
      <div class="loading-spinner" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()
</script>

<style scoped>
.now-playing {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 20px;
}

.cover-area {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transition: transform var(--transition-normal);
}

.cover-area:hover {
  transform: scale(1.02);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  border: 2px dashed var(--border-light);
  color: var(--text-muted);
}

.track-info {
  text-align: center;
  max-width: 100%;
}

.track-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.track-artist {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.loading-overlay {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinning {
  animation: disc-spin 4s linear infinite;
}

@keyframes disc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .now-playing {
    padding: 24px 16px;
    gap: 14px;
  }

  .cover-area,
  .cover-placeholder {
    width: 140px;
    height: 140px;
  }

  .track-title {
    font-size: 16px;
    max-width: 220px;
  }
}
</style>
