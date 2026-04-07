<template>
  <div class="lyrics-panel" :class="{ 'has-translation': lyrics.hasTranslation }">
    <div class="lyrics-header" v-if="showHeader">
      <h3 class="lyrics-title">
        <SvgIcon name="music" :size="14" />
        歌词
      </h3>
      <div class="lyrics-actions" v-if="lyrics.hasTranslation">
        <button class="lyrics-btn" :class="{ active: showTranslation }" @click="showTranslation = !showTranslation">
          译
        </button>
      </div>
    </div>

    <div class="lyrics-scroll" ref="scrollContainer">
      <div class="lyrics-top-spacer" />

      <div
        v-for="(line, index) in lyrics.lines"
        :key="index"
        :ref="el => { if (el) lineRefs[index] = el as HTMLElement }"
        class="lyric-line"
        :class="{
          active: index === currentLineIndex,
          passed: index < currentLineIndex,
          hasTranslation: line.translation && showTranslation
        }"
        @click="seekToLine(line)"
      >
        <div class="lyric-text">{{ line.text }}</div>
        <div class="lyric-translation" v-if="line.translation && showTranslation">
          {{ line.translation }}
        </div>
      </div>

      <div class="lyrics-bottom-spacer" />
    </div>

    <div class="lyrics-empty" v-if="lyrics.lines.length === 0">
      <SvgIcon name="music" :size="32" />
      <p>{{ noLyricsText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import type { LyricsData, Track } from '@/types'
import { parseLRC, findCurrentLineIndex } from '@/services/lyricsParser'

const props = withDefaults(defineProps<{
  track?: Track | null
  showHeader?: boolean
  noLyricsText?: string
}>(), {
  showHeader: true,
  noLyricsText: '暂无歌词'
})

const player = useAudioPlayer()
const scrollContainer = ref<HTMLElement | null>(null)
const lineRefs: Record<number, HTMLElement> = {}
const currentLineIndex = ref(-1)
const showTranslation = ref(true)
const isUserScrolling = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let isProgrammaticScroll = false // Guard: don't let programmatic scroll trigger isUserScrolling

// Parse lyrics from current track
const lyrics = computed<LyricsData>(() => {
  const t = props.track || player.currentTrack.value
  if (!t || !t.lrc) return { lines: [], hasTranslation: false }
  return parseLRC(t.lrc)
})

// Watch current time to update active line
watch(() => player.currentTime.value, (time) => {
  const idx = findCurrentLineIndex(lyrics.value.lines, time)
  if (idx !== currentLineIndex.value) {
    currentLineIndex.value = idx
    // Auto-scroll to the active line (unless user is scrolling)
    if (!isUserScrolling.value && idx >= 0) {
      scrollToActiveLine(idx)
    }
  }
})

// Watch track change
watch(() => props.track, () => {
  currentLineIndex.value = -1
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
})

function scrollToActiveLine(index: number) {
  nextTick(() => {
    const el = lineRefs[index]
    const container = scrollContainer.value
    if (!el || !container) return

    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()

    // Calculate where the element is relative to the container's center
    const elCenter = elRect.top - containerRect.top + elRect.height / 2
    const containerCenter = containerRect.height / 2
    const offset = elCenter - containerCenter

    // Only scroll if the line is not already centered (with some tolerance)
    if (Math.abs(offset) > 3) {
      // Mark as programmatic so onScroll doesn't set isUserScrolling
      isProgrammaticScroll = true
      container.scrollTop += offset
      // Reset the flag after the scroll event fires (next microtask is too early, use rAF)
      requestAnimationFrame(() => {
        isProgrammaticScroll = false
      })
    }
  })
}

function onScroll() {
  // Ignore scroll events caused by programmatic scrolling
  if (isProgrammaticScroll) return

  isUserScrolling.value = true
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    isUserScrolling.value = false
  }, 3000)
}

function seekToLine(line: { time: number }) {
  player.seek(line.time)
}

onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', onScroll, { passive: true })
  }
})

onUnmounted(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', onScroll)
  }
})
</script>

<style scoped>
.lyrics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  user-select: none;
  position: relative;
}

.lyrics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.lyrics-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.lyrics-actions {
  display: flex;
  gap: 4px;
}

.lyrics-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.lyrics-btn:hover,
.lyrics-btn.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.lyrics-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* NO scroll-behavior: smooth — it causes lag in lyrics sync */
  /* Gradient mask: fade edges */
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0,0,0,0.6) 8%,
    black 20%,
    black 80%,
    rgba(0,0,0,0.6) 92%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0,0,0,0.6) 8%,
    black 20%,
    black 80%,
    rgba(0,0,0,0.6) 92%,
    transparent 100%
  );
}

/* Spacer: push first lyric to the vertical center of the container */
/* Use calc to ensure at least 2 lines are visible when container is small */
.lyrics-top-spacer {
  height: calc(50% - 40px);
  min-height: 20px;
  flex-shrink: 0;
  pointer-events: none;
}

/* Bottom spacer mirrors the top */
.lyrics-bottom-spacer {
  height: calc(50% - 40px);
  min-height: 20px;
  flex-shrink: 0;
  pointer-events: none;
}

.lyric-line {
  padding: 8px 24px;
  cursor: pointer;
  transition: color 0.3s ease, opacity 0.3s ease;
  min-height: 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.lyric-text {
  font-size: 15px;
  color: var(--text-muted);
  transition: all 0.3s ease;
  line-height: 1.8;
  text-align: center;
}

.lyric-line.hasTranslation .lyric-text {
  margin-bottom: 4px;
}

.lyric-translation {
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.5;
  transition: all 0.3s ease;
  line-height: 1.6;
  text-align: center;
}

/* ===== Active (current) line ===== */
.lyric-line.active .lyric-text {
  font-size: 17px;
  font-weight: 600;
  color: var(--accent);
  text-shadow: 0 0 20px var(--accent-glow, rgba(255, 106, 0, 0.4)),
               0 0 40px var(--accent-glow, rgba(255, 106, 0, 0.2));
}

.lyric-line.active .lyric-translation {
  font-size: 14px;
  color: var(--text-secondary);
  opacity: 0.9;
}

.lyric-line.passed .lyric-text {
  color: var(--text-secondary);
  opacity: 0.5;
}

.lyric-line:hover .lyric-text {
  color: var(--text-primary);
}

.lyrics-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 40px;
}

.lyrics-empty p {
  font-size: 14px;
}

/* Scrollbar */
.lyrics-scroll::-webkit-scrollbar {
  width: 4px;
}

.lyrics-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.lyrics-scroll::-webkit-scrollbar-thumb {
  background: var(--bg-hover);
  border-radius: 2px;
}
</style>
