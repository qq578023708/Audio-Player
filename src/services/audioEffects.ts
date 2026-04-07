import { Howler } from 'howler'

// Web Audio API equalizer using BiquadFilterNodes
export class AudioEqualizer {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private filters: BiquadFilterNode[] = []
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private isInitialized = false
  private currentGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 10 bands
  private audioElement: HTMLAudioElement | null = null
  private _hasRealData = false // Whether analyser actually returns non-zero data (CORS check)

  // Standard 10-band EQ frequencies
  static readonly FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

  // Built-in presets
  static readonly PRESETS = {
    flat: { name: '平坦', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    pop: { name: '流行', gains: [0, 1, 2, 3, 3, 2, 1, 0, 1, 2] },
    rock: { name: '摇滚', gains: [4, 2, -1, 1, 3, 3, 0, -1, -1, 3] },
    jazz: { name: '爵士', gains: [3, 2, 0, 2, -2, -2, 0, 1, 2, 3] },
    classical: { name: '古典', gains: [4, 2, 0, 0, 0, 0, 0, 2, 3, 4] },
    electronic: { name: '电子', gains: [4, 3, 1, -1, -2, 0, 1, 3, 4, 4] },
    bass_boost: { name: '重低音', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
    vocal: { name: '人声增强', gains: [-1, 0, 1, 2, 4, 4, 3, 1, 0, -1] },
    acoustic: { name: '原声', gains: [3, 2, 1, 0, -1, 0, 1, 2, 3, 3] },
    hiphop: { name: '嘻哈', gains: [5, 4, 2, 0, -1, 1, 2, 3, 4, 4] },
  }

  // Reverb presets
  static readonly REVERB_PRESETS = {
    none: { name: '无', decay: 0, mix: 0 },
    small_room: { name: '小房间', decay: 0.5, mix: 0.15 },
    large_room: { name: '大房间', decay: 1.2, mix: 0.25 },
    hall: { name: '音乐厅', decay: 2.0, mix: 0.3 },
    stadium: { name: '体育馆', decay: 3.0, mix: 0.35 },
  }

  /** Whether the analyser returns real frequency data (false if CORS-blocked) */
  get hasRealData(): boolean {
    return this._hasRealData
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  async initialize(): Promise<boolean> {
    try {
      // Find the audio element that Howler is using
      const audioElements = document.getElementsByTagName('audio')
      if (audioElements.length === 0) {
        console.warn('[AudioEQ] No audio element found, will retry later')
        return false
      }

      const newAudioEl = audioElements[audioElements.length - 1] as HTMLAudioElement

      // If audio element changed (Howler recreated it), re-initialize
      if (this.isInitialized && this.audioElement === newAudioEl) {
        return true
      }

      // Clean up previous connections if re-initializing
      if (this.isInitialized) {
        this.cleanupNodes()
      }

      this.audioElement = newAudioEl

      // Set crossOrigin to allow Web Audio API to read frequency data
      if (!this.audioElement.crossOrigin) {
        this.audioElement.crossOrigin = 'anonymous'
      }

      // Create or resume AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Create nodes
      try {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement)
      } catch (e: any) {
        // "HTMLMediaElement already connected" — element already bound
        console.warn('[AudioEQ] createMediaElementSource failed (element may already be connected):', e.message)
        // If we already have an analyser, it might still work with the old connection
        if (this.analyserNode) {
          this.isInitialized = true
          this.startCorsCheck()
          return true
        }
        return false
      }

      // Create 10-band filters
      this.filters = AudioEqualizer.FREQUENCIES.map((freq, i) => {
        const filter = this.audioContext!.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = freq
        filter.Q.value = 1.4
        filter.gain.value = this.currentGains[i]
        return filter
      })

      // Chain filters: source -> filter1 -> filter2 -> ... -> gain -> analyser -> destination
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 1.0

      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.75

      // Connect chain
      this.sourceNode.connect(this.filters[0])
      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1])
      }
      this.filters[this.filters.length - 1].connect(this.gainNode)
      this.gainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.audioContext.destination)

      this.isInitialized = true
      console.log('[AudioEQ] Equalizer initialized successfully')
      this.startCorsCheck()
      return true
    } catch (e) {
      console.error('[AudioEQ] Failed to initialize:', e)
      return false
    }
  }

  /**
   * After initialization, sample the analyser a few times to check if
   * we're getting real data or if CORS is blocking it (all zeros).
   */
  private corsCheckTimer: ReturnType<typeof setInterval> | null = null

  private startCorsCheck() {
    this._hasRealData = false
    if (this.corsCheckTimer) clearInterval(this.corsCheckTimer)
    let checks = 0
    this.corsCheckTimer = setInterval(() => {
      checks++
      const data = this.getFrequencyData()
      const sum = data.reduce((a, b) => a + b, 0)
      if (sum > 100) {
        // Got real data — CORS is not blocking
        this._hasRealData = true
        console.log('[AudioEQ] Real frequency data confirmed (CORS OK)')
        clearInterval(this.corsCheckTimer!)
        this.corsCheckTimer = null
      } else if (checks >= 10) {
        // After ~1s of checks, still all zeros — CORS is blocking
        this._hasRealData = false
        console.warn('[AudioEQ] Frequency data all zeros — likely CORS-blocked, falling back to simulated visualization')
        clearInterval(this.corsCheckTimer!)
        this.corsCheckTimer = null
      }
    }, 100)
  }

  private cleanupNodes() {
    try {
      this.sourceNode?.disconnect()
      this.filters.forEach(f => f.disconnect())
      this.gainNode?.disconnect()
      this.analyserNode?.disconnect()
    } catch (e) {
      // ignore
    }
    this.sourceNode = null
    this.filters = []
    this.gainNode = null
    this.analyserNode = null
    if (this.corsCheckTimer) {
      clearInterval(this.corsCheckTimer)
      this.corsCheckTimer = null
    }
  }

  setBandGain(bandIndex: number, gain: number): void {
    if (bandIndex < 0 || bandIndex >= this.filters.length) return

    const clampedGain = Math.max(-12, Math.min(12, gain))
    this.currentGains[bandIndex] = clampedGain

    if (this.filters[bandIndex]) {
      this.filters[bandIndex].gain.setValueAtTime(
        clampedGain,
        this.audioContext?.currentTime || 0
      )
    }
  }

  setPreset(gains: number[]): void {
    for (let i = 0; i < Math.min(gains.length, 10); i++) {
      this.setBandGain(i, gains[i])
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(2, volume)),
        this.audioContext?.currentTime || 0
      )
    }
  }

  getCurrentGains(): number[] {
    return [...this.currentGains]
  }

  // Get frequency data for visualization
  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0)
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(data)
    return data
  }

  // Get time domain data for waveform
  getWaveformData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0)
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteTimeDomainData(data)
    return data
  }

  dispose(): void {
    this.cleanupNodes()
    try {
      this.audioContext?.close()
    } catch (e) {
      // ignore
    }
    this.isInitialized = false
    this.audioContext = null
    this.audioElement = null
  }

  reset(): void {
    this.setPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  }
}

// Singleton equalizer instance
let eqInstance: AudioEqualizer | null = null

export function getEqualizer(): AudioEqualizer {
  if (!eqInstance) {
    eqInstance = new AudioEqualizer()
  }
  return eqInstance
}
