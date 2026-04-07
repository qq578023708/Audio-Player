<template>
  <div class="progress-bar" ref="barRef" @mousedown="onMouseDown" @touchstart="onTouchStart">
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${player.progress.value * 100}%` }">
        <div class="progress-thumb" />
      </div>
    </div>
    <span class="time current">{{ player.formattedCurrentTime.value }}</span>
    <span class="time total">{{ player.formattedDuration.value }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()
const barRef = ref<HTMLElement | null>(null)

function getPercent(e: MouseEvent | Touch): number {
  if (!barRef.value) return 0
  const rect = barRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  return Math.max(0, Math.min(1, x))
}

function seekToPercent(percent: number) {
  player.seekByPercent(percent)
}

function onMouseDown(e: MouseEvent) {
  const percent = getPercent(e)
  seekToPercent(percent)

  const onMouseMove = (ev: MouseEvent) => {
    seekToPercent(getPercent(ev))
  }
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 0) return
  const percent = getPercent(e.touches[0])
  seekToPercent(percent)

  const onTouchMove = (ev: TouchEvent) => {
    if (ev.touches.length > 0) {
      seekToPercent(getPercent(ev.touches[0]))
    }
  }
  const onTouchEnd = () => {
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  }
  document.addEventListener('touchmove', onTouchMove)
  document.addEventListener('touchend', onTouchEnd)
}
</script>

<style scoped>
.progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 600px;
  padding: 8px 0;
  cursor: pointer;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  position: relative;
  transition: height var(--transition-fast);
}

.progress-bar:hover .progress-track {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  position: relative;
  transition: width 0.1s linear;
}

.progress-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity var(--transition-fast);
  box-shadow: 0 0 6px var(--accent-glow);
}

.progress-bar:hover .progress-thumb {
  opacity: 1;
}

.time {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 36px;
  text-align: center;
  white-space: nowrap;
}

.time.current {
  text-align: right;
}

.time.total {
  text-align: left;
}

@media (max-width: 768px) {
  .progress-bar {
    padding: 12px 0;
  }
}
</style>
