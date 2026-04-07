<template>
  <div class="demo-tracks">
    <div class="section-title">
      <SvgIcon name="music" :size="16" />
      <span>试听示例</span>
    </div>
    <div class="demo-list">
      <button
        v-for="(track, i) in demoTracks"
        :key="i"
        class="demo-item"
        @click="player.playUrl(track.url, track.title, track.artist, track.cover)"
      >
        <div class="demo-info">
          <span class="demo-title">{{ track.title }}</span>
          <span class="demo-artist">{{ track.artist }}</span>
        </div>
        <SvgIcon name="play" :size="14" class="demo-play-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()

// Public domain / free audio samples for demo
const demoTracks = [
  {
    title: '古典钢琴 - 贝多芬月光奏鸣曲',
    artist: 'Beethoven',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    cover: ''
  },
  {
    title: '电子音乐 - SoundHelix 2',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    cover: ''
  },
  {
    title: '摇滚节拍 - SoundHelix 3',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cover: ''
  },
  {
    title: '氛围音乐 - SoundHelix 6',
    artist: 'SoundHelix',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    cover: ''
  }
]
</script>

<style scoped>
.demo-tracks {
  padding: 12px 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.demo-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  text-align: left;
}

.demo-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.demo-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  font-size: 11px;
  color: var(--text-muted);
}

.demo-play-icon {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.demo-item:hover .demo-play-icon {
  opacity: 1;
}
</style>
