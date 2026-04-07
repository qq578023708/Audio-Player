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

    <div class="lyrics-scroll" ref="scrollContainer" @scroll="onScroll">
      <div class="lyrics-padding" :style="{ height: `${viewportHeight * 0.4}px` }" />

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

      <div class="lyrics-padding" :style="{ height: `${viewportHeight * 0.4}px` }" />
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
const viewportHeight = ref(600)

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
    if (!isUserScrolling.value) {
      scrollToLine(idx)
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

function scrollToLine(index: number) {
  nextTick(() => {
    const el = lineRefs[index]
    if (!el || !scrollContainer.value) return

    const container = scrollContainer.value
    const containerHeight = container.clientHeight
    const lineTop = el.offsetTop
    const lineHeight = el.clientHeight

    // Center the active line
    const targetScroll = lineTop - containerHeight / 2 + lineHeight / 2
    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    })
  })
}

function onScroll() {
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
  viewportHeight.value = window.innerHeight
  window.addEventListener('resize', () => {
    viewportHeight.value = window.innerHeight
  })
})

onUnmounted(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
})
</script>

<style scoped>
.lyrics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  user-select: none;
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
  scroll-behavior: smooth;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.lyric-line {
  padding: 10px 24px;
  cursor: pointer;
  transition: all 0.35s ease;
}

.lyric-text {
  font-size: 15px;
  color: var(--text-muted);
  transition: all 0.35s ease;
  line-height: 1.8;
}

.lyric-line.hasTranslation .lyric-text {
  margin-bottom: 4px;
}

.lyric-translation {
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.5;
  transition: all 0.35s ease;
  line-height: 1.6;
}

.lyric-line.active .lyric-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent);
  transform: scale(1.02);
}

.lyric-line.active .lyric-translation {
  font-size: 14px;
  color: var(--text-secondary);
  opacity: 0.9;
}

.lyric-line.passed .lyric-text {
  color: var(--text-secondary);
  opacity: 0.6;
}

.lyric-line:hover .lyric-text {
  color: var(--text-primary);
}

.lyrics-padding {
  flex-shrink: 0;
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
