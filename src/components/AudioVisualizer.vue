<template>
  <div class="audio-visualizer" ref="containerRef">
    <canvas ref="canvasRef" :style="{ width: '100%', height: height + 'px' }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getEqualizer } from '@/services/audioEffects'

const props = withDefaults(defineProps<{
  barCount?: number
  isPlaying?: boolean
  height?: number
  color?: string
}>(), {
  barCount: 30,
  isPlaying: false,
  height: 32,
  color: '#ff6a00'
})

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let useRealData = false

// ===== Log frequency mapping constants =====
const MIN_FREQ = 30
const MAX_FREQ = 16000
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_MAX = Math.log2(MAX_FREQ)

function buildLogBins(totalBins: number, numBars: number, sampleRate: number): Array<{ start: number; end: number }> {
  const binHz = sampleRate / 2 / totalBins
  const bins: Array<{ start: number; end: number }> = []
  for (let i = 0; i < numBars; i++) {
    const fracLow = i / numBars
    const fracHigh = (i + 1) / numBars
    const freqLow = Math.pow(2, LOG_MIN + fracLow * (LOG_MAX - LOG_MIN))
    const freqHigh = Math.pow(2, LOG_MIN + fracHigh * (LOG_MAX - LOG_MIN))
    const startBin = Math.max(0, Math.floor(freqLow / binHz))
    const endBin = Math.min(totalBins - 1, Math.ceil(freqHigh / binHz))
    bins.push({ start: startBin, end: endBin })
  }
  return bins
}

// ===== Canvas rendering =====
let ctx: CanvasRenderingContext2D | null = null
let canvasW = 0
let canvasH = 0

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvasW = rect.width * dpr
  canvasH = props.height * dpr
  canvas.width = canvasW
  canvas.height = canvasH
  ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
}

const W = () => canvasW / (window.devicePixelRatio || 1)
const H = () => canvasH / (window.devicePixelRatio || 1)

// ===== Frequency data (smoothed per bar) =====
let logBinMap: Array<{ start: number; end: number }> = []
const smoothBars = new Float32Array(128)

// ===== Simulated beat engine =====
let beatAccum = 0
let beatInterval = 0.5
let nextBeatAt = 0.5
let beatEnergy = 0
let fillEnergy = 0
let simTime = 0
const simBarPhases = new Float32Array(128)
const simBarSpeeds = new Float32Array(128)
const simBarHeights = new Float32Array(128)
const simBarVelocities = new Float32Array(128)

function resetSimState(n: number) {
  beatEnergy = 0.6
  beatAccum = 0
  beatInterval = 0.45 + Math.random() * 0.2
  nextBeatAt = beatInterval
  fillEnergy = 0
  simTime = 0
  for (let i = 0; i < n && i < 128; i++) {
    simBarPhases[i] = Math.random() * Math.PI * 2
    simBarSpeeds[i] = 1 + Math.random() * 4
    simBarHeights[i] = 0.1
    simBarVelocities[i] = 0
  }
}

function updateSimBeat(dt: number) {
  simTime += dt
  beatAccum += dt

  if (beatAccum >= nextBeatAt) {
    beatAccum = 0
    beatInterval = 0.4 + Math.random() * 0.2
    if (Math.random() < 0.15) beatInterval *= 0.5
    nextBeatAt = beatInterval
    beatEnergy = 0.8 + Math.random() * 0.2
  }

  beatEnergy *= 0.82

  const fillCycle = simTime % 6
  if (fillCycle > 5.2 && fillCycle < 5.4) {
    fillEnergy = Math.min(1, fillEnergy + dt * 5)
  } else {
    fillEnergy *= 0.92
  }
}

function getSimBarHeight(i: number, n: number): number {
  const freqNorm = i / n
  const baseEnergy = 0.15 + 0.6 * Math.pow(1 - freqNorm, 1.8)
  const beatImpact = beatEnergy * Math.pow(Math.max(0, 1 - freqNorm * 3), 2) * 1.2
  const fillImpact = fillEnergy * 0.5 * (1 - Math.abs(freqNorm - 0.4) * 1.5)
  const phase = simBarPhases[i % 128]
  const speed = simBarSpeeds[i % 128]
  const osc = Math.sin(simTime * speed + phase) * 0.08 +
              Math.sin(simTime * speed * 2.3 + phase * 1.7) * 0.04

  let target = baseEnergy + beatImpact + fillImpact + osc
  target = Math.max(0.02, Math.min(1.0, target))

  const spring = 0.25
  const damp = 0.78
  const diff = target - simBarHeights[i % 128]
  simBarVelocities[i % 128] = (simBarVelocities[i % 128] + diff * spring) * damp
  simBarHeights[i % 128] = Math.max(0, Math.min(1, simBarHeights[i % 128] + simBarVelocities[i % 128]))

  return simBarHeights[i % 128]
}

// ===== Color helper =====
function getBarColor(ratio: number, alpha = 1): string {
  const r = 255
  const g = Math.round(106 - ratio * 61)  // 106 → 45
  const b = Math.round(ratio * 85)         // 0 → 85
  return `rgba(${r},${g},${b},${alpha})`
}

// ===== Mirror render: left-right mirror + top-bottom symmetric + fade-out reflection =====
function drawMirror(bars: Float32Array, halfN: number) {
  if (!ctx) return
  const w = W()
  const h = H()
  ctx.clearRect(0, 0, w, h)

  const midY = h / 2
  const maxBarH = midY * 0.88
  const midX = w / 2

  // Layout: bars grow outward from center on both sides
  // Left half: bars spread from midX leftward
  // Right half: mirror of left
  // Top half: bars grow upward from midY
  // Bottom half: fade-out reflection downward from midY

  // Calculate bar width based on half the width
  const gap = 2
  const halfW = midX
  const barW = Math.max(1, (halfW - gap * (halfN - 1)) / halfN)

  // Draw each bar: left side + right side (mirror)
  for (let i = 0; i < halfN; i++) {
    const val = bars[i]
    const barH = Math.max(1, val * maxBarH)

    // Position from center outward
    // i=0 is closest to center, i=halfN-1 is at the edge
    const distFromCenter = i * (barW + gap)

    // Left side bar x: starts from midX and goes left
    const leftX = midX - distFromCenter - barW
    // Right side bar x: mirror of left
    const rightX = midX + distFromCenter

    const ratio = i / halfN // 0 = center (bass), 1 = edge (treble)

    // ---- Top half (bars grow upward from midY) ----
    const gradUp = ctx.createLinearGradient(0, midY - barH, 0, midY)
    gradUp.addColorStop(0, getBarColor(ratio, 0.95))
    gradUp.addColorStop(0.7, getBarColor(ratio, 0.6))
    gradUp.addColorStop(1, getBarColor(ratio, 0.35))

    ctx.fillStyle = gradUp

    // Left top bar
    const radius = Math.min(barW / 2, 2.5)
    drawRoundedBar(leftX, midY - barH, barW, barH, radius, 'top')
    // Right top bar (mirror)
    drawRoundedBar(rightX, midY - barH, barW, barH, radius, 'top')

    // ---- Bottom half (reflection: fade-out downward) ----
    const reflectionH = barH * 0.55
    const gradDown = ctx.createLinearGradient(0, midY, 0, midY + reflectionH)
    gradDown.addColorStop(0, getBarColor(ratio, 0.25))
    gradDown.addColorStop(0.5, getBarColor(ratio, 0.1))
    gradDown.addColorStop(1, getBarColor(ratio, 0))

    ctx.fillStyle = gradDown
    ctx.fillRect(leftX, midY + 1, barW, reflectionH)  // +1 to avoid pixel gap
    ctx.fillRect(rightX, midY + 1, barW, reflectionH)

    // Glow on bright bars (only for bars with significant energy)
    if (val > 0.4) {
      ctx.shadowBlur = 6
      ctx.shadowColor = getBarColor(ratio, 0.35 * val)
      ctx.fillStyle = getBarColor(ratio, 0.15)
      ctx.fillRect(leftX, midY - barH, barW, barH)
      ctx.fillRect(rightX, midY - barH, barW, barH)
      ctx.shadowBlur = 0
    }

    // Bright cap at the top edge of each bar
    if (val > 0.05) {
      ctx.fillStyle = getBarColor(ratio, 0.8 * Math.min(1, val * 1.5))
      ctx.fillRect(leftX, midY - barH, barW, 1.5)
      ctx.fillRect(rightX, midY - barH, barW, 1.5)
    }
  }

  // Center glow line (horizontal)
  const centerGrad = ctx.createLinearGradient(0, midY - 1, 0, midY + 1)
  centerGrad.addColorStop(0, 'rgba(255,106,0,0.25)')
  centerGrad.addColorStop(1, 'rgba(255,106,0,0.08)')
  ctx.fillStyle = centerGrad
  ctx.fillRect(0, midY - 0.5, w, 1)

  // Center vertical bright dot
  ctx.beginPath()
  ctx.arc(midX, midY, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,140,50,0.6)'
  ctx.fill()
}

function drawRoundedBar(x: number, y: number, w: number, h: number, r: number, roundSide: 'top' | 'bottom') {
  if (!ctx) return
  ctx.beginPath()
  if (roundSide === 'top') {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
  } else {
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  }
  ctx.closePath()
  ctx.fill()
}

// ===== Main animation loop =====
let lastFrameTime = 0

function animate(timestamp: number) {
  if (!ctx) {
    animationId = requestAnimationFrame(animate)
    return
  }

  const dt = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.1) : 1 / 60
  lastFrameTime = timestamp

  // barCount is total bars; we use half for each side of the mirror
  const halfN = Math.ceil(props.barCount / 2)

  if (useRealData) {
    const eq = getEqualizer()
    const data = eq.getFrequencyData()

    if (data.length > 0 && logBinMap.length >= halfN) {
      for (let i = 0; i < halfN; i++) {
        const { start, end } = logBinMap[i]
        let sum = 0
        let count = 0
        for (let j = start; j <= end && j < data.length; j++) {
          sum += data[j] * data[j]
          count++
        }
        const rms = count > 0 ? Math.sqrt(sum / count) / 255 : 0

        const freqRatio = i / halfN
        const boost = freqRatio < 0.2 ? 1.8 : freqRatio < 0.4 ? 1.3 : 1.0
        const target = Math.min(1.0, rms * boost)

        if (target > smoothBars[i]) {
          smoothBars[i] += (target - smoothBars[i]) * 0.6
        } else {
          smoothBars[i] += (target - smoothBars[i]) * 0.12
        }
        smoothBars[i] = Math.max(0, smoothBars[i])
      }
    }
  } else {
    updateSimBeat(dt)
    for (let i = 0; i < halfN; i++) {
      smoothBars[i] = getSimBarHeight(i, halfN)
    }
  }

  drawMirror(smoothBars, halfN)
  animationId = requestAnimationFrame(animate)
}

// ===== Lifecycle =====
onMounted(async () => {
  setupCanvas()
  resetSimState(Math.ceil(props.barCount / 2))

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

watch(() => props.barCount, (newCount) => {
  resetSimState(Math.ceil(newCount / 2))
})

async function tryStartVisualization() {
  const eq = getEqualizer()
  const ok = await eq.initialize()
  if (ok) {
    setTimeout(() => {
      if (eq.hasRealData) {
        useRealData = true
        const analyser = eq.getAnalyser()
        if (analyser) {
          const sampleRate = analyser.context.sampleRate || 48000
          logBinMap = buildLogBins(analyser.frequencyBinCount, Math.ceil(props.barCount / 2), sampleRate)
        }
        startAnimation()
      } else {
        useRealData = false
        resetSimState(Math.ceil(props.barCount / 2))
        startAnimation()
      }
    }, 1200)
  } else {
    useRealData = false
    resetSimState(Math.ceil(props.barCount / 2))
    startAnimation()
  }
}

function startAnimation() {
  if (animationId) cancelAnimationFrame(animationId)
  lastFrameTime = 0
  animationId = requestAnimationFrame(animate)
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  useRealData = false
  lastFrameTime = 0

  const halfN = Math.ceil(props.barCount / 2)
  const fade = () => {
    let allZero = true
    for (let i = 0; i < halfN; i++) {
      smoothBars[i] = Math.max(0, smoothBars[i] - 0.08)
      if (smoothBars[i] > 0.001) allZero = false
    }
    if (ctx) ctx.clearRect(0, 0, W(), H())
    if (!allZero) requestAnimationFrame(fade)
  }
  fade()
}

function onResize() {
  setupCanvas()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  stopAnimation()
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.audio-visualizer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: v-bind(height + 'px');
  width: 100%;
}
</style>
