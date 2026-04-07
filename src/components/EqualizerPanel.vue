<template>
  <div class="eq-panel">
    <div class="eq-header">
      <h3 class="eq-title">
        <SvgIcon name="settings" :size="14" />
        均衡器
      </h3>
      <button class="eq-reset" @click="resetEQ">重置</button>
    </div>

    <!-- Presets -->
    <div class="eq-presets">
      <button
        v-for="preset in presetList"
        :key="preset.id"
        class="preset-btn"
        :class="{ active: activePreset === preset.id }"
        @click="applyPreset(preset.id)"
      >
        {{ preset.name }}
      </button>
    </div>

    <!-- EQ Bands -->
    <div class="eq-bands">
      <div v-for="(freq, index) in frequencies" :key="freq" class="eq-band">
        <div class="band-label">{{ formatFreq(freq) }}</div>
        <div class="band-slider-wrap">
          <input
            type="range"
            class="band-slider"
            :class="{ positive: gains[index] > 0, negative: gains[index] < 0 }"
            min="-12"
            max="12"
            step="0.5"
            :value="gains[index]"
            @input="onBandChange(index, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="band-value" :class="{ positive: gains[index] > 0 }">
          {{ gains[index] > 0 ? '+' : '' }}{{ gains[index] }}dB
        </div>
      </div>
    </div>

    <!-- Spectrum visualization -->
    <div class="eq-spectrum" v-if="showSpectrum">
      <canvas ref="spectrumCanvas" width="280" height="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { AudioEqualizer, getEqualizer } from '@/services/audioEffects'

const props = withDefaults(defineProps<{ showSpectrum?: boolean }>(), { showSpectrum: true })

const frequencies = AudioEqualizer.FREQUENCIES
const presetList = Object.entries(AudioEqualizer.PRESETS).map(([id, p]) => ({
  id,
  name: p.name,
  gains: p.gains
}))

const gains = reactive<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const activePreset = ref('flat')
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)
let eq: AudioEqualizer = getEqualizer()
let animationId: number | null = null

function onBandChange(index: number, value: number) {
  gains[index] = value
  activePreset.value = ''
  eq?.setBandGain(index, value)
}

function applyPreset(id: string) {
  const preset = AudioEqualizer.PRESETS[id as keyof typeof AudioEqualizer.PRESETS]
  if (!preset) return
  activePreset.value = id
  for (let i = 0; i < preset.gains.length; i++) {
    gains[i] = preset.gains[i]
  }
  eq?.setPreset(preset.gains)
}

function resetEQ() {
  applyPreset('flat')
}

function formatFreq(freq: number): string {
  if (freq >= 1000) return `${freq / 1000}k`
  return `${freq}`
}

// Spectrum visualization
function drawSpectrum() {
  if (!spectrumCanvas.value || !eq) return

  const ctx = spectrumCanvas.value.getContext('2d')
  if (!ctx) return

  const data = eq.getFrequencyData()
  if (!data || data.length === 0) {
    animationId = requestAnimationFrame(drawSpectrum)
    return
  }

  const width = spectrumCanvas.value.width
  const height = spectrumCanvas.value.height
  ctx.clearRect(0, 0, width, height)

  const barCount = 32
  const barWidth = width / barCount - 1
  const step = Math.floor(data.length / barCount)

  for (let i = 0; i < barCount; i++) {
    const value = data[i * step] / 255
    const barHeight = Math.max(2, value * height)

    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
    gradient.addColorStop(0, 'rgba(255, 106, 0, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 45, 85, 0.6)')

    ctx.fillStyle = gradient
    ctx.fillRect(i * (barWidth + 1), height - barHeight, barWidth, barHeight)
  }

  animationId = requestAnimationFrame(drawSpectrum)
}

onMounted(async () => {
  // Use shared singleton — ensure initialized
  const ok = await eq.initialize()
  if (ok && props.showSpectrum) {
    drawSpectrum()
  }
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  // Don't dispose the shared singleton EQ
})

watch(() => props.showSpectrum, (val) => {
  if (val && eq) {
    drawSpectrum()
  } else if (!val && animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})
</script>

<style scoped>
.eq-panel {
  padding: 16px;
}

.eq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.eq-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.eq-reset {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: var(--radius-xs);
  transition: all var(--transition-fast);
}

.eq-reset:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.eq-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.preset-btn {
  padding: 5px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.preset-btn:hover {
  border-color: var(--border-light);
  background: var(--bg-hover);
}

.preset-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.eq-bands {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eq-band {
  display: flex;
  align-items: center;
  gap: 10px;
}

.band-label {
  width: 30px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: right;
  flex-shrink: 0;
}

.band-slider-wrap {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}

.band-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: none;
  cursor: pointer;
}

.band-slider.positive {
  background: linear-gradient(to right, var(--bg-tertiary), rgba(255, 106, 0, 0.5));
}

.band-slider.negative {
  background: linear-gradient(to left, var(--bg-tertiary), rgba(59, 130, 246, 0.5));
}

.band-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.band-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.band-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

.band-value {
  width: 48px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: left;
  flex-shrink: 0;
}

.band-value.positive {
  color: var(--accent);
}

.eq-spectrum {
  margin-top: 18px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
  padding: 4px;
}

.eq-spectrum canvas {
  width: 100%;
  height: 60px;
  display: block;
}
</style>
