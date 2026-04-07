<template>
  <div class="audio-visualizer" ref="container">
    <div
      v-for="(bar, i) in barCount"
      :key="i"
      class="viz-bar"
      :style="{
        height: `${barHeights[i]}%`,
        background: getBarGradient(i),
      }"
      :class="{ active: isPlaying }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getEqualizer } from '@/services/audioEffects'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const props = withDefaults(defineProps<{
  barCount?: number
  isPlaying?: boolean
  height?: number
  color?: string
}>(), {
  barCount: 20,
  isPlaying: false,
  height: 32,
  color: '#ff6a00'
})

const player = useAudioPlayer()
const container = ref<HTMLElement | null>(null)
const barHeights = ref<number[]>([])
let animationId: number | null = null
let useRealData = false

// Simulated spectrum state
const targetHeights = ref<number[]>([])
const velocity = ref<number[]>([])
let lastBeatTime = 0
let beatInterval = 500 // ms — will vary randomly
let nextBeatTime = 0
let beatEnergy = 0 // decays after each beat

// Per-bar oscillators with individual phases for organic look
const barPhases = ref<number[]>([])
const barSpeeds = ref<number[]>([])

function initBarState() {
  const n = props.barCount
  barHeights.value = new Array(n).fill(0)
  targetHeights.value = new Array(n).fill(0)
  velocity.value = new Array(n).fill(0)
  barPhases.value = Array.from({ length: n }, () => Math.random() * Math.PI * 2)
  barSpeeds.value = Array.from({ length: n }, () => 0.5 + Math.random() * 2.5)
}

onMounted(async () => {
  initBarState()
  if (props.isPlaying) {
    await tryStartVisualization()
  }
})

watch(() => props.isPlaying, async (playing) => {
  if (playing) {
    await tryStartVisualization()
  } else {
    stopAnimation()
  }
})

async function tryStartVisualization() {
  const eq = getEqualizer()
  const ok = await eq.initialize()
  if (ok) {
    // Wait for CORS check to complete
    setTimeout(() => {
      if (eq.hasRealData) {
        useRealData = true
        startRealVisualization()
      } else {
        startSimulatedVisualization()
      }
    }, 1200)
  } else {
    startSimulatedVisualization()
  }
}

function startRealVisualization() {
  if (animationId) cancelAnimationFrame(animationId)
  const eq = getEqualizer()

  function draw() {
    const data = eq.getFrequencyData()
    if (data.length > 0) {
      const barCount = props.barCount
      const step = Math.max(1, Math.floor(data.length / barCount))
      const heights: number[] = []
      for (let i = 0; i < barCount; i++) {
        const binStart = i * step
        const binEnd = Math.min(binStart + step, data.length)
        let sum = 0
        for (let j = binStart; j < binEnd; j++) {
          sum += data[j]
        }
        const avg = sum / (binEnd - binStart)
        heights.push(Math.max(0, (avg / 255) * 100))
      }
      barHeights.value = heights
    }
    animationId = requestAnimationFrame(draw)
  }
  draw()
}

/**
 * Rhythm-aware simulated spectrum.
 * 
 * Key principles:
 * 1. Beat-driven: regular "kick" hits inject energy into bass bars, which then decay
 * 2. Energy distribution mimics real music (low freq = high energy)
 * 3. Each bar has independent phase/speed for organic movement
 * 4. Beat intervals vary slightly (like a real drummer, not a metronome)
 * 5. Occasional "fills" — bursts of energy across all bars
 * 6. Smooth spring physics for natural bar motion
 */
function startSimulatedVisualization() {
  if (animationId) cancelAnimationFrame(animationId)
  const now = performance.now()
  lastBeatTime = now
  nextBeatTime = now + beatInterval
  beatEnergy = 0.8 // Start with energy

  // Reset bar states
  for (let i = 0; i < props.barCount; i++) {
    barPhases.value[i] = Math.random() * Math.PI * 2
    barSpeeds.value[i] = 0.5 + Math.random() * 2.5
    velocity.value[i] = 0
  }

  function draw() {
    const now = performance.now()
    const t = now / 1000
    const dt = 1 / 60 // assume ~60fps
    const n = props.barCount

    // --- Beat engine ---
    if (now >= nextBeatTime) {
      // Trigger a beat
      beatEnergy = 0.7 + Math.random() * 0.3
      lastBeatTime = now

      // Variable interval: ~400-700ms (120-150 BPM range with humanized timing)
      beatInterval = 400 + Math.random() * 300
      // Occasionally do a double-beat (syncopation)
      if (Math.random() < 0.15) {
        beatInterval = beatInterval * 0.5
      }
      nextBeatTime = now + beatInterval
    }

    // Beat energy decays quickly (like a real drum hit)
    beatEnergy *= 0.88

    // Occasional fill (every ~4-8 seconds) — energy burst across wider range
    const fillPhase = (t % 6)
    const isFill = fillPhase > 5.5 && fillPhase < 5.8
    const fillBoost = isFill ? 0.6 : 0

    // --- Calculate target height for each bar ---
    for (let i = 0; i < n; i++) {
      const freq = i / n // 0..1 (low to high frequency)

      // Base energy curve: bass-heavy
      const baseEnergy = Math.max(0.05, 0.9 - freq * 0.7)

      // Beat impact: strongest on bass bars, barely affects treble
      const beatImpact = beatEnergy * Math.max(0, 1 - freq * 2.5) * 0.8

      // Individual bar oscillation (each bar dances to its own rhythm)
      const phase = barPhases.value[i]
      const speed = barSpeeds.value[i]
      const osc = Math.sin(t * speed + phase) * 0.12 +
                  Math.sin(t * speed * 1.7 + phase * 0.6) * 0.06

      // Add fill energy
      const fillEnergy = fillBoost * Math.max(0, 0.8 - freq * 0.5)

      // Combine into target
      let target = baseEnergy + beatImpact + osc + fillEnergy
      target = Math.max(0.03, Math.min(1.0, target))

      targetHeights.value[i] = target
    }

    // --- Spring physics for smooth bar motion ---
    const springK = 0.15 // stiffness
    const damping = 0.72 // velocity damping

    const heights: number[] = []
    for (let i = 0; i < n; i++) {
      const diff = targetHeights.value[i] * 100 - barHeights.value[i]
      velocity.value[i] = (velocity.value[i] + diff * springK) * damping
      const h = Math.max(0, Math.min(100, barHeights.value[i] + velocity.value[i]))
      heights.push(h)
    }

    barHeights.value = heights
    animationId = requestAnimationFrame(draw)
  }
  draw()
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  useRealData = false
  // Smoothly fade bars to 0
  const fade = () => {
    let allZero = true
    barHeights.value = barHeights.value.map(h => {
      const next = Math.max(0, h - 6)
      if (next > 0) allZero = false
      return next
    })
    if (!allZero) requestAnimationFrame(fade)
  }
  fade()
}

function getBarGradient(index: number): string {
  const ratio = index / props.barCount
  const hue = 20 + ratio * 340 // orange to pink
  return `linear-gradient(to top, hsl(${hue}, 100%, 50%), hsl(${hue}, 100%, 65%))`
}

onUnmounted(() => {
  stopAnimation()
})
</script>

<style scoped>
.audio-visualizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: v-bind(height + 'px');
}

.viz-bar {
  width: 3px;
  border-radius: 1.5px;
  min-height: 2px;
  transition: height 0.08s ease-out;
  opacity: 0.4;
}

.viz-bar.active {
  opacity: 1;
}
</style>
