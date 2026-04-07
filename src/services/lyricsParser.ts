import type { LyricLine, LyricsData } from '@/types'

/**
 * Parse LRC format lyrics text into structured data
 * Supports: [mm:ss.xx], [mm:ss], [mm:ss.xxx], [offset:xxx]
 * Supports multi-timestamp lines and translation format
 */
export function parseLRC(lrcText: string): LyricsData {
  if (!lrcText || !lrcText.trim()) {
    return { lines: [], hasTranslation: false }
  }

  const rawLines: { time: number; text: string; isTranslation: boolean }[] = []
  const lines = lrcText.split('\n')

  // Global offset
  let globalOffset = 0
  const offsetMatch = lrcText.match(/\[offset:(-?\d+)\]/i)
  if (offsetMatch) {
    globalOffset = parseInt(offsetMatch[1]) / 1000 // ms to seconds
  }

  // Translation patterns:
  // Pattern 1: Original and translation on same line separated by space or tab
  // Pattern 2: Translation line immediately follows original line
  let hasTranslation = false
  const timeLineMap = new Map<number, string>()    // time -> original text
  const timeTransMap = new Map<number, string>()   // time -> translation

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue

    // Extract all timestamps from the line
    const timestamps = extractTimestamps(trimmed)
    if (timestamps.length === 0) continue

    // Extract the text after the last timestamp
    const text = extractText(trimmed)

    // Detect if this is a translation (various patterns)
    const isTranslation = detectTranslation(text, trimmed)

    for (const time of timestamps) {
      if (isTranslation) {
        timeTransMap.set(time, text)
        hasTranslation = true
      } else {
        timeLineMap.set(time, text)
      }
    }
  }

  // Merge original and translations
  const mergedLines: LyricLine[] = []
  const sortedTimes = [...timeLineMap.keys()].sort((a, b) => a - b)

  for (const time of sortedTimes) {
    const text = timeLineMap.get(time) || ''
    if (!text.trim()) continue // skip empty lines (metadata, etc.)

    mergedLines.push({
      time: time + globalOffset,
      text: text.trim(),
      translation: timeTransMap.get(time) || undefined
    })
  }

  // If no translation found but original lines exist with both Chinese and non-Chinese,
  // try to pair consecutive lines as translation pairs
  if (!hasTranslation && mergedLines.length > 1) {
    for (let i = 0; i < mergedLines.length - 1; i++) {
      const current = mergedLines[i]
      const next = mergedLines[i + 1]
      // If next line is likely a translation of current line (no timestamp overlap)
      if (isLikelyTranslationPair(current.text, next.text)) {
        current.translation = next.text
        mergedLines.splice(i + 1, 1)
        hasTranslation = true
      }
    }
  }

  return {
    lines: mergedLines,
    hasTranslation,
    offset: globalOffset
  }
}

// Extract timestamps from an LRC line
function extractTimestamps(line: string): number[] {
  const timestamps: number[] = []
  const regex = /\[(\d{1,3}):(\d{2})(?:[:.](\d{1,3}))?\]/g
  let match

  while ((match = regex.exec(line)) !== null) {
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    let millis = 0
    if (match[3]) {
      millis = parseInt(match[3].padEnd(3, '0'))
    }
    timestamps.push(minutes * 60 + seconds + millis / 1000)
  }

  return timestamps
}

// Extract text content after all timestamps
function extractText(line: string): string {
  // Remove all [mm:ss.xx] timestamps
  return line.replace(/\[\d{1,3}:\d{2}[:.]\d{1,3}\]/g, '').trim()
}

// Detect if a line is a translation
function detectTranslation(text: string, fullLine: string): boolean {
  if (!text) return false

  // Translation typically in parentheses or different language indicator
  // Some LRC files use /to: prefix
  if (fullLine.includes('/to:')) return true

  // Some plugins mark translations differently
  if (fullLine.includes('[tr:') || fullLine.includes('[trans:')) return true

  // If text is wrapped in parentheses/brackets after removing timestamps
  if (/^[\(（\[【].+[\)）\]】]$/.test(text)) return true

  return false
}

// Check if two consecutive lines are likely a translation pair
function isLikelyTranslationPair(original: string, translation: string): boolean {
  if (!original || !translation) return false

  // If one is primarily Chinese and the other is primarily not
  const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s)
  const origChinese = hasChinese(original)
  const transChinese = hasChinese(translation)

  // Translation pair: one is Chinese, other is non-Chinese
  return origChinese !== transChinese
}

// Find the current lyric line index based on time
export function findCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
  if (lines.length === 0) return -1

  // Binary search for efficiency
  let lo = 0
  let hi = lines.length - 1

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (lines[mid].time <= currentTime) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return Math.max(0, hi)
}

// Format seconds to mm:ss
export function formatLyricTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}
