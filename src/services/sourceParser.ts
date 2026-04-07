import type { ParsedSourcePlugin, MusicSource, MusicQuality } from '@/types'

// Parse LX Music source plugin from JS code string
export function parseLxSourcePlugin(code: string, fileName: string): ParsedSourcePlugin | null {
  try {
    // Extract sources info from the plugin code
    const sources = extractSources(code)
    const qualitys = extractQualitys(code)
    const apiUrl = extractApiUrl(code)
    const type = apiUrl ? 'proxy' : 'direct'
    const name = extractName(code, fileName)
    const version = extractVersion(code)

    if (sources.length === 0) {
      console.warn(`[SourceParser] No sources found in ${fileName}`)
      return null
    }

    return {
      name,
      version,
      sources,
      qualitys,
      type,
      apiUrl,
      code,
      fileName,
      enabled: true,
      initialized: false,
      sourceCapabilities: {},
    }
  } catch (e) {
    console.error(`[SourceParser] Failed to parse ${fileName}:`, e)
    return null
  }
}

// Extract source identifiers from plugin code
function extractSources(code: string): MusicSource[] {
  const sources: MusicSource[] = []
  const knownSources: MusicSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']

  // Pattern 1: sources: ['kw', 'kg', ...]
  const sourcesArrayMatch = code.match(/sources?\s*[:=]\s*\[([^\]]+)\]/i)
  if (sourcesArrayMatch) {
    const arr = sourcesArrayMatch[1]
    for (const src of knownSources) {
      if (arr.includes(`'${src}'`) || arr.includes(`"${src}"`)) {
        sources.push(src)
      }
    }
  }

  // Pattern 2: individual source definitions like `kw: { ... }`
  if (sources.length === 0) {
    const sourceBlockRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\{[^}]*source\s*:\s*['"]?(kw|kg|tx|wy|mg)['"]?/gi
    let match
    while ((match = sourceBlockRegex.exec(code)) !== null) {
      const src = match[1] as MusicSource
      if (!sources.includes(src)) sources.push(src)
    }

    // Also check for object keys like `kw: {`
    for (const src of knownSources) {
      const keyPattern = new RegExp(`(?:^|[,{\\n\\s])${src}\\s*:\\s*\\{`, 'm')
      if (keyPattern.test(code) && !sources.includes(src)) {
        sources.push(src)
      }
    }
  }

  // Pattern 3: qualitys array (also indicates which sources are supported)
  if (sources.length === 0) {
    for (const src of knownSources) {
      const hasRef = code.includes(`'${src}'`) || code.includes(`"${src}"`)
      if (hasRef) sources.push(src)
    }
  }

  // Pattern 4: "Aggregated API" plugins that dynamically dispatch by source variable
  // Signs: uses template literals like `${source}` in URL, or checks `source == "kg"`,
  // or references `info.musicInfo.songmid` / `info.musicInfo.hash` alongside `source`
  if (sources.length < 3) {
    const hasDynamicSource = 
      /\$\{source\}/.test(code) ||              // Template: `/url/${source}/...`
      /source\s*==\s*['"]/.test(code) ||         // Conditional: source == "kg"
      /info\.musicInfo\.(songmid|hash)/.test(code) // References songmid/hash (multi-source)
    
    if (hasDynamicSource) {
      // This plugin dynamically handles multiple sources — add all known ones
      console.log(`[SourceParser] Detected aggregated/multi-source plugin, adding all known sources`)
      for (const src of knownSources) {
        if (!sources.includes(src)) sources.push(src)
      }
    }
  }

  // Ensure at least one source
  if (sources.length === 0 && (code.includes('url') || code.includes('music'))) {
    sources.push('kw') // default fallback
  }

  return [...new Set(sources)]
}

// Extract quality levels
function extractQualitys(code: string): MusicQuality[] {
  const qualities: MusicQuality[] = ['128k', '320k', 'flac', 'flac24bit']
  const found: MusicQuality[] = []

  const qualityMatch = code.match(/qualitys?\s*[:=]\s*\[([^\]]+)\]/i)
  if (qualityMatch) {
    const arr = qualityMatch[1]
    for (const q of qualities) {
      if (arr.includes(q)) found.push(q)
    }
  }

  return found.length > 0 ? found : ['128k', '320k']
}

// Extract API URL from proxy-type plugins
function extractApiUrl(code: string): string {
  // Pattern: const API_URL = 'https://...'
  const urlMatch = code.match(/(?:API_URL|apiUrl|baseUrl|BASE_URL|api_url)\s*[:=]\s*['"]([^'"]+)['"]/i)
  if (urlMatch) return urlMatch[1]

  // Pattern: https://.../url/${source}/${songId}
  const urlPattern = code.match(/['"]https?:\/\/[^'"]+\/url\/['"]?/)
  if (urlPattern) {
    const url = urlPattern[0].replace(/['"]/g, '')
    return url.replace(/\/url\/.*$/, '')
  }

  // Pattern: any https:// URL that looks like an API
  const apiMatch = code.match(/['"]https?:\/\/[^'"]+['"]/)
  if (apiMatch) {
    const url = apiMatch[0].replace(/['"]/g, '')
    // Only return if it looks like an API URL (not a documentation URL)
    if (url.includes('api') || url.includes('render') || url.includes('service')) {
      return url
    }
  }

  return ''
}

// Extract plugin name
function extractName(code: string, fileName: string): string {
  // Priority 1: @name JSDoc comment (common in LX Music plugins)
  const atNameMatch = code.match(/@name\s+(.+)/i)
  if (atNameMatch) {
    const name = atNameMatch[1].trim()
    if (name.length > 2 && name.length < 50) return name
  }

  // Priority 2: name: 'XXX' (in code)
  const nameMatch = code.match(/name\s*[:=]\s*['"]([^'"]+)['"]/i)
  if (nameMatch) {
    const name = nameMatch[1]
    if (name.length > 2 && name.length < 50) return name
  }

  // Use filename without extension
  return fileName.replace(/\.(js|ts)$/i, '')
}

// Extract version
function extractVersion(code: string): string {
  // Priority 1: @version JSDoc comment
  const atVersionMatch = code.match(/@version\s+(.+)/i)
  if (atVersionMatch) return atVersionMatch[1].trim()

  // Priority 2: version: 'XXX' (in code)
  const versionMatch = code.match(/version\s*[:=]\s*['"]([^'"]+)['"]/i)
  return versionMatch ? versionMatch[1] : '1.0.0'
}

// Build proxy URL for fetching music stream
export function buildProxyMusicUrl(apiUrl: string, source: MusicSource, songId: string, quality: MusicQuality): string {
  // Common pattern: {baseUrl}/url/{source}/{songId}/{quality}
  const url = apiUrl.replace(/\/+$/, '')
  return `${url}/url/${source}/${songId}/${quality}`
}

// Try to extract songId from a track
export function getTrackSourceId(track: { sourceId?: string; hash?: string; songmid?: string; id?: string }): string {
  return track.sourceId || track.hash || track.songmid || track.id || ''
}

// Source display name mapping
export const SOURCE_NAMES: Record<string, string> = {
  kw: '酷我音乐',
  kg: '酷狗音乐',
  tx: 'QQ音乐',
  wy: '网易云音乐',
  mg: '咪咕音乐',
  local: '本地文件',
  url: '直链URL'
}

export const SOURCE_COLORS: Record<string, string> = {
  kw: '#ff6a00',
  kg: '#2196f3',
  tx: '#31c27c',
  wy: '#e60026',
  mg: '#ff2d55',
  local: '#6a6a82',
  url: '#8b5cf6'
}
