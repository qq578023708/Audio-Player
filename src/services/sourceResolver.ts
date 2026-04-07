/**
 * Source Resolver Service
 * 
 * Handles:
 * 1. Searching for songs across music platforms
 * 2. Resolving track URLs through LX Music plugins
 * 3. Fetching lyrics through plugins
 * 4. Auto-switching sources on failure
 */

import type {
  Track, MusicSource, MusicQuality, LxMusicInfo, 
  SourceResolveResult, SourceLyricResult, SearchTrackItem,
  ParsedSourcePlugin,
} from '@/types'
import { createLxEngine, getLxEngine, destroyLxEngine, type LxEngineInstance } from './lxEngine'

// ===== Search API =====

// Public music search APIs (no auth required)
const SEARCH_APIS: Record<string, (keyword: string, page: number) => Promise<SearchTrackItem[]>> = {
  kw: searchKuwo,
  kg: searchKugou,
  tx: searchQQ,
  wy: searchWangyi,
  mg: searchMigu,
}

/**
 * Search songs across all or specific platform
 */
export async function searchSongs(
  keyword: string,
  source?: MusicSource,
  page: number = 1,
  limit: number = 30
): Promise<SearchTrackItem[]> {
  const sources = source ? [source] : ['kw', 'kg', 'wy'] as MusicSource[]
  const results: SearchTrackItem[] = []

  for (const src of sources) {
    try {
      const apiFn = SEARCH_APIS[src]
      if (!apiFn) continue
      
      const items = await apiFn(keyword, page)
      for (const item of items) {
        if (results.length >= limit) break
        results.push(item)
      }
      
      if (results.length >= limit) break
    } catch (e) {
      console.warn(`[SourceResolver] Search failed for ${src}:`, e)
    }
  }

  return results
}

/**
 * Convert SearchTrackItem to Track
 */
export function searchItemToTrack(item: SearchTrackItem): Track {
  return {
    id: `search_${item.source}_${item.id}_${Date.now()}`,
    title: item.name,
    artist: item.singer,
    album: item.album,
    cover: item.albumPic,
    duration: item.duration,
    url: '', // Will be resolved by source plugin
    source: item.source,
    sourceId: item.id,
    songmid: item.songmid || item.id,
    hash: item.hash,
    strMediaMid: item.strMediaMid,
  }
}

// ===== Source URL Resolution =====

/**
 * Resolve a playable URL for a track using source plugins
 * Tries each available plugin in priority order
 */
export async function resolveTrackUrl(
  track: Track,
  quality: MusicQuality = '320k',
  plugins: ParsedSourcePlugin[]
): Promise<SourceResolveResult> {
  const source = track.source || 'kw'
  const songId = track.sourceId || track.songmid || track.hash || track.id

  const musicInfo: LxMusicInfo = {
    id: songId,
    songmid: track.songmid || songId,
    name: track.title,
    singer: track.artist,
    album: track.album,
    duration: track.duration ? track.duration * 1000 : undefined,
    source,
    // Source-specific fields that plugins may expect
    hash: track.hash || undefined,           // Kugou hash
    rid: track.sourceId || songId,          // Kuwo rid
    copyrightId: track.sourceId ? parseInt(track.sourceId) || undefined : undefined, // Migu copyrightId
    strMediaMid: track.strMediaMid,         // QQ Music specific
  }

  // Try each plugin that supports this source
  const matchingPlugins = plugins.filter(p =>
    p.enabled && p.sources.includes(source)
  )

  for (const plugin of matchingPlugins) {
    try {
      let engine = getLxEngine(plugin.name)
      
      // Initialize if needed
      if (!engine || !engine.initialized) {
        engine = await createLxEngine(plugin)
        if (!engine) continue
      }

      // Check if this plugin supports musicUrl for this source
      const cap = engine.capabilities.get(source)
      if (cap && !cap.actions.includes('musicUrl')) {
        continue
      }

      // getMusicUrl already normalizes and throws if URL is invalid
      const url = await engine.getMusicUrl(musicInfo, quality)
      return {
        url,
        quality,
        source,
        pluginName: plugin.name,
      }
    } catch (e) {
      // Only log error details if there are multiple plugins (otherwise it's redundant)
      if (matchingPlugins.length > 1) {
        console.warn(`[SourceResolver] Plugin ${plugin.name} failed for "${track.title}":`, e)
      }
    }
  }

  // Log summary only once
  console.warn(`[SourceResolver] All ${matchingPlugins.length} plugin(s) failed for "${track.title}" (source: ${source})`)
  throw new Error(`无法解析 "${track.title}" 的播放地址，所有音源均失败`)
}

/**
 * Try to resolve URL with auto-switching to next source on failure
 */
export async function resolveWithAutoSwitch(
  track: Track,
  quality: MusicQuality = '320k',
  plugins: ParsedSourcePlugin[],
  triedSources: Set<MusicSource> = new Set()
): Promise<SourceResolveResult> {
  const source = track.source || 'kw'
  const attempt = triedSources.size + 1
  
  if (triedSources.has(source)) {
    // Already tried this source, try another
    const nextSource = getNextAvailableSource(source, plugins, triedSources)
    if (nextSource) {
      triedSources.add(nextSource)
      const modifiedTrack = { ...track, source: nextSource }
      return resolveWithAutoSwitch(modifiedTrack, quality, plugins, triedSources)
    }
    throw new Error(`所有音源均无法播放 "${track.title}"`)
  }

  triedSources.add(source)
  console.log(`[SourceResolver] Resolving "${track.title}" (source=${source}, attempt ${attempt})`)

  try {
    return await resolveTrackUrl(track, quality, plugins)
  } catch (e) {
    const nextSource = getNextAvailableSource(source, plugins, triedSources)
    if (nextSource) {
      console.log(`[SourceResolver] Source ${source} failed, switching to ${nextSource}...`)
      const modifiedTrack = { ...track, source: nextSource }
      return resolveWithAutoSwitch(modifiedTrack, quality, plugins, triedSources)
    }
    console.warn(`[SourceResolver] All sources exhausted for "${track.title}"`)
    throw e
  }
}

// ===== Lyric Resolution =====

/**
 * Resolve lyrics for a track using source plugins
 */
export async function resolveLyric(
  track: Track,
  plugins: ParsedSourcePlugin[]
): Promise<SourceLyricResult | null> {
  const source = track.source || 'kw'
  const songId = track.sourceId || track.songmid || track.hash || track.id

  const musicInfo: LxMusicInfo = {
    id: songId,
    songmid: track.songmid || songId,
    name: track.title,
    singer: track.artist,
    album: track.album,
    source,
  }

  for (const plugin of plugins) {
    if (!plugin.enabled || !plugin.sources.includes(source)) continue
    
    try {
      let engine = getLxEngine(plugin.name)
      if (!engine || !engine.initialized) {
        engine = await createLxEngine(plugin)
        if (!engine) continue
      }

      const cap = engine.capabilities.get(source)
      // Note: Some plugins handle lyric requests even without declaring it in capabilities.
      // Only skip if capability explicitly EXCLUDES lyric actions (future-proofing).
      // Previously we skipped when !cap.actions.includes('lyric'), which was too strict.

      const result = await engine.getLyric(musicInfo)
      if (result && result.lyric) return result
    } catch (e) {
      console.warn(`[SourceResolver] Lyric resolve failed for ${plugin.name}:`, e)
    }
  }

  // Fallback: fetch lyrics from public API
  return fetchLyricFromPublicApi(musicInfo)
}

// ===== Cover Resolution =====

export async function resolveCover(
  track: Track,
  plugins: ParsedSourcePlugin[]
): Promise<string | null> {
  if (track.cover) return track.cover

  const source = track.source || 'kw'
  const songId = track.sourceId || track.songmid || track.hash || track.id

  const musicInfo: LxMusicInfo = { id: songId, source }

  for (const plugin of plugins) {
    if (!plugin.enabled || !plugin.sources.includes(source)) continue
    
    try {
      let engine = getLxEngine(plugin.name)
      if (!engine || !engine.initialized) {
        engine = await createLxEngine(plugin)
        if (!engine) continue
      }

      const result = await engine.getPic(musicInfo)
      if (result) return result
    } catch (e) {
      // skip
    }
  }

  return null
}

// ===== Plugin Lifecycle =====

export async function initializePlugin(plugin: ParsedSourcePlugin): Promise<boolean> {
  try {
    const engine = await createLxEngine(plugin)
    return engine?.initialized || false
  } catch (e) {
    console.error(`[SourceResolver] Failed to init plugin ${plugin.name}:`, e)
    return false
  }
}

export function uninitializePlugin(pluginName: string) {
  destroyLxEngine(pluginName)
}

// ===== Search Implementations =====

// Note: These are public/unofficial APIs that may change.
// In production, you'd want to use a backend proxy.

async function searchKuwo(keyword: string, page: number): Promise<SearchTrackItem[]> {
  try {
    const resp = await fetch(`/api/search-kw/r.s?all=${encodeURIComponent(keyword)}&ft=music&rn=30&pn=${page}&encoding=utf8`)
    const text = await resp.text()
    
    // Kuwo returns a special format
    const data: any = {}
    const matches = text.match(/(\w+)=([^&$]*)/g) || []
    for (const m of matches) {
      const [k, ...rest] = m.split('=')
      data[k] = rest.join('=')
    }

    const abslist = (data.abslist || '[]') as string
    const items: SearchTrackItem[] = []
    
    try {
      const parsed = JSON.parse(abslist.replace(/'/g, '"'))
      for (const item of (parsed || []).slice(0, 30)) {
        if (item.MUSICRID) {
          const id = item.MUSICRID.replace('MUSICRID_', '')
          items.push({
            id,
            source: 'kw',
            name: item.SONGNAME || item.NAME || '',
            singer: item.ARTIST || '',
            album: item.ALBUM || '',
            albumPic: item.web_albumpic_short || '',
            duration: item.DURATION ? Math.round(item.DURATION) : undefined,
          })
        }
      }
    } catch {
      // Try alternative parsing
      const ridMatch = text.match(/rid=(\d+)/g) || []
      const nameMatches = text.match(/SONGNAME=([^&$]*)/g) || []
      for (let i = 0; i < Math.min(ridMatch.length, nameMatches.length); i++) {
        const id = ridMatch[i].replace('rid=', '')
        const name = decodeURIComponent(nameMatches[i].replace('SONGNAME=', ''))
        items.push({ id, source: 'kw', name, singer: '', album: '', duration: undefined })
      }
    }

    return items
  } catch (e) {
    console.warn('[Search] Kuwo search failed:', e)
    return []
  }
}

async function searchKugou(keyword: string, page: number): Promise<SearchTrackItem[]> {
  try {
    // Kugou has CORS restrictions, use a simpler approach
    const resp = await fetch(`/api/search-kg/api/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=30&plat=0`)
    const data = await resp.json()
    
    return (data?.data?.info || []).map((item: any) => ({
      id: item.hash || item.songid?.toString() || '',
      source: 'kg' as MusicSource,
      name: item.songname || '',
      singer: item.singername || '',
      album: item.album_name || '',
      albumPic: item.img || '',
      duration: item.duration ? Math.round(item.duration) : undefined,
      hash: item.hash,
    }))
  } catch (e) {
    console.warn('[Search] Kugou search failed:', e)
    return []
  }
}

async function searchQQ(keyword: string, page: number): Promise<SearchTrackItem[]> {
  try {
    const resp = await fetch(`/api/search-tx/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&p=${page}&n=30&format=json`)
    const data = await resp.json()
    
    return (data?.data?.song?.list || []).map((item: any) => ({
      id: item.songmid || item.songid?.toString() || '',
      source: 'tx' as MusicSource,
      name: item.songname || '',
      singer: item.singer?.map((s: any) => s.name).join('/') || '',
      album: item.albumname || '',
      albumPic: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : '',
      duration: item.interval || undefined,
      songmid: item.songmid,
      strMediaMid: item.strMediaMid,
    }))
  } catch (e) {
    console.warn('[Search] QQ Music search failed:', e)
    return []
  }
}

async function searchWangyi(keyword: string, page: number): Promise<SearchTrackItem[]> {
  try {
    const resp = await fetch(`/api/search-wy/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=${(page - 1) * 30}&limit=30`)
    const data = await resp.json()
    
    return (data?.result?.songs || []).map((item: any) => ({
      id: item.id?.toString() || '',
      source: 'wy' as MusicSource,
      name: item.name || '',
      singer: item.artists?.map((a: any) => a.name).join('/') || '',
      album: item.album?.name || '',
      albumPic: item.album?.picUrl || '',
      duration: item.duration ? Math.round(item.duration / 1000) : undefined,
    }))
  } catch (e) {
    console.warn('[Search] Wangyi search failed:', e)
    return []
  }
}

async function searchMigu(keyword: string, page: number): Promise<SearchTrackItem[]> {
  try {
    const resp = await fetch(`/api/search-mg/MIGUM3.0/v1.0/content/search_all.do?text=${encodeURIComponent(keyword)}&pageNo=${page}&pageSize=30&searchSwitch=%7B%22song%22%3A1%7D`)
    const data = await resp.json()
    
    return (data?.songResultData?.result || []).map((item: any) => ({
      id: item.id || '',
      source: 'mg' as MusicSource,
      name: item.songName || '',
      singer: item.singerName || '',
      album: item.albumName || '',
      albumPic: item.cover || '',
      duration: item.duration ? Math.round(item.duration) : undefined,
    }))
  } catch (e) {
    console.warn('[Search] Migu search failed:', e)
    return []
  }
}

// ===== Chart/Rankings API (from LX Music source) =====

export interface ChartSongItem {
  id: string
  source: MusicSource
  name: string
  singer: string
  album: string
  albumPic?: string
  duration?: number
  songmid?: string
  hash?: string
  // Quality info (optional, from leaderboard data)
  types?: Array<{ type: string; size: string }>
}

export interface ChartBoardInfo {
  id: string       // unique id like 'kwbiaosb'
  name: string     // display name like '飙升榜'
  bangid: string   // platform chart id like '93'
  source: MusicSource
}

export interface ChartData {
  id: string
  name: string
  source: MusicSource
  items: ChartSongItem[]
}

// ---- Board Lists (from LX Music desktop source) ----
// Path: src/renderer/utils/musicSdk/{kw,kg,tx,wy,mg}/leaderboard.js

const KW_BOARDS: ChartBoardInfo[] = [
  { id: 'kwbiaosb', name: '飙升榜', bangid: '93', source: 'kw' },
  { id: 'kwregb', name: '热歌榜', bangid: '16', source: 'kw' },
  { id: 'kwhuiyb', name: '会员榜', bangid: '145', source: 'kw' },
  { id: 'kwdouyb', name: '抖音榜', bangid: '158', source: 'kw' },
  { id: 'kwqsb', name: '趋势榜', bangid: '187', source: 'kw' },
  { id: 'kwhuaijb', name: '怀旧榜', bangid: '26', source: 'kw' },
  { id: 'kwhuayb', name: '华语榜', bangid: '104', source: 'kw' },
  { id: 'kwyueyb', name: '粤语榜', bangid: '182', source: 'kw' },
  { id: 'kwoumb', name: '欧美榜', bangid: '22', source: 'kw' },
  { id: 'kwhanyb', name: '韩语榜', bangid: '184', source: 'kw' },
  { id: 'kwriyb', name: '日语榜', bangid: '183', source: 'kw' },
]

const KG_BOARDS: ChartBoardInfo[] = [
  { id: 'kgtop500', name: 'TOP500', bangid: '8888', source: 'kg' },
  { id: 'kgwlhgb', name: '网络榜', bangid: '23784', source: 'kg' },
  { id: 'kgbsb', name: '飙升榜', bangid: '6666', source: 'kg' },
  { id: 'kgfxb', name: '分享榜', bangid: '21101', source: 'kg' },
  { id: 'kgcyyb', name: '纯音乐榜', bangid: '33164', source: 'kg' },
  { id: 'kggfjqb', name: '古风榜', bangid: '33161', source: 'kg' },
  { id: 'kgyyjqb', name: '粤语榜', bangid: '33165', source: 'kg' },
  { id: 'kgomjqb', name: '欧美榜', bangid: '33166', source: 'kg' },
  { id: 'kgdyrgb', name: '电音榜', bangid: '33160', source: 'kg' },
  { id: 'kgjdrgb', name: 'DJ热歌榜', bangid: '24971', source: 'kg' },
  { id: 'kghyxgb', name: '华语新歌榜', bangid: '31308', source: 'kg' },
]

const TX_BOARDS: ChartBoardInfo[] = [
  { id: 'txlxzsb', name: '流行榜', bangid: '4', source: 'tx' },
  { id: 'txrgb', name: '热歌榜', bangid: '26', source: 'tx' },
  { id: 'txwlhgb', name: '网络榜', bangid: '28', source: 'tx' },
  { id: 'txdyb', name: '抖音榜', bangid: '60', source: 'tx' },
  { id: 'txndb', name: '内地榜', bangid: '5', source: 'tx' },
  { id: 'txxgb', name: '香港榜', bangid: '59', source: 'tx' },
  { id: 'txtwb', name: '台湾榜', bangid: '61', source: 'tx' },
  { id: 'txoumb', name: '欧美榜', bangid: '3', source: 'tx' },
  { id: 'txhgb', name: '韩国榜', bangid: '16', source: 'tx' },
  { id: 'txrbb', name: '日本榜', bangid: '17', source: 'tx' },
  { id: 'txtybb', name: 'YouTube榜', bangid: '128', source: 'tx' },
]

const WY_BOARDS: ChartBoardInfo[] = [
  { id: 'wybsb', name: '飙升榜', bangid: '19723756', source: 'wy' },
  { id: 'wyrgb', name: '热歌榜', bangid: '3778678', source: 'wy' },
  { id: 'wyxgb', name: '新歌榜', bangid: '3779629', source: 'wy' },
  { id: 'wyycb', name: '原创榜', bangid: '2884035', source: 'wy' },
  { id: 'wygdb', name: '古典榜', bangid: '71384707', source: 'wy' },
  { id: 'wydouyb', name: '抖音榜', bangid: '2250011882', source: 'wy' },
  { id: 'wyhyb', name: '韩语榜', bangid: '745956260', source: 'wy' },
  { id: 'wydianyb', name: '电音榜', bangid: '1978921795', source: 'wy' },
  { id: 'wydjb', name: '电竞榜', bangid: '2006508653', source: 'wy' },
  { id: 'wyktvbb', name: 'KTV唛榜', bangid: '21845217', source: 'wy' },
]

const MG_BOARDS: ChartBoardInfo[] = [
  { id: 'mgyyb', name: '音乐榜', bangid: '27553319', source: 'mg' },
  { id: 'mgysb', name: '影视榜', bangid: '23603721', source: 'mg' },
  { id: 'mghybnd', name: '华语内地榜', bangid: '23603926', source: 'mg' },
  { id: 'mghyjqbgt', name: '华语港台榜', bangid: '23603954', source: 'mg' },
  { id: 'mgomb', name: '欧美榜', bangid: '23603974', source: 'mg' },
  { id: 'mgrhb', name: '日韩榜', bangid: '23603982', source: 'mg' },
  { id: 'mgwlb', name: '网络榜', bangid: '23604058', source: 'mg' },
  { id: 'mgclb', name: '彩铃榜', bangid: '23604023', source: 'mg' },
  { id: 'mgktvb', name: 'KTV榜', bangid: '23604040', source: 'mg' },
  { id: 'mgrcb', name: '原创榜', bangid: '23604032', source: 'mg' },
]

const ALL_BOARDS: Record<MusicSource, ChartBoardInfo[]> = {
  kw: KW_BOARDS,
  kg: KG_BOARDS,
  tx: TX_BOARDS,
  wy: WY_BOARDS,
  mg: MG_BOARDS,
}

/**
 * Get available board list for a source
 */
export function getBoardList(source: MusicSource): ChartBoardInfo[] {
  return ALL_BOARDS[source] || []
}

/**
 * Get all boards for all sources
 */
export function getAllBoards(): ChartBoardInfo[] {
  return Object.values(ALL_BOARDS).flat()
}

/**
 * Fetch a single board's song list by board id
 */
export async function fetchBoardSongs(
  source: MusicSource,
  bangid: string,
  page: number = 1,
  limit: number = 100
): Promise<{ items: ChartSongItem[]; total: number }> {
  const fetcher = BOARD_FETCHERS[source]
  if (!fetcher) return { items: [], total: 0 }
  try {
    return await fetcher(bangid, page, limit)
  } catch (e) {
    console.warn(`[SourceResolver] Board fetch failed for ${source}/${bangid}:`, e)
    return { items: [], total: 0 }
  }
}

/**
 * Fetch chart data — returns first 3 default boards for a source (for quick load)
 */
export async function fetchChartList(
  source: MusicSource,
  _chartType: string = 'hot'
): Promise<ChartData[]> {
  const boards = ALL_BOARDS[source] || []
  // Load the first 3 boards by default
  const defaultBoards = boards.slice(0, 3)
  const results: ChartData[] = []

  await Promise.all(
    defaultBoards.map(async (board) => {
      try {
        const { items } = await fetchBoardSongs(source, board.bangid, 1, 100)
        if (items.length > 0) {
          results.push({
            id: board.id,
            name: board.name,
            source,
            items: items.slice(0, 50),
          })
        }
      } catch {
        // skip individual board failures
      }
    })
  )

  return results
}

// ===== Board Fetchers (LX Music API addresses) =====

type BoardFetcher = (bangid: string, page: number, limit: number) => Promise<{ items: ChartSongItem[]; total: number }>

const BOARD_FETCHERS: Record<string, BoardFetcher> = {
  kw: fetchKwBoard,
  kg: fetchKgBoard,
  tx: fetchTxBoard,
  wy: fetchWyBoard,
  mg: fetchMgBoard,
}

// ---- Kuwo Board Fetcher ----
// Uses wbdCrypto encrypted API via server-side proxy (/api/kw-board)
async function fetchKwBoard(bangid: string, page: number, limit: number): Promise<{ items: ChartSongItem[]; total: number }> {
  const resp = await fetch(`/api/kw-board/songs?id=${bangid}&page=${page}&limit=${limit}`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const rawData = await resp.json()
  if (rawData.code !== 200 || !rawData.data?.musiclist) {
    throw new Error(`Kuwo API error: ${rawData.code}`)
  }

  const list = rawData.data.musiclist || []
  const decodeName = (str: string) => {
    try { return decodeURIComponent(escape(str)) } catch { return str }
  }
  const formatSinger = (str: string) => str.replace(/&/g, '、')

  return {
    total: parseInt(rawData.data.total) || list.length,
    items: list.map((s: any) => ({
      id: (s.id || '').toString(),
      source: 'kw' as MusicSource,
      name: decodeName(s.name || ''),
      singer: formatSinger(decodeName(s.artist || '')),
      album: decodeName(s.album || ''),
      albumPic: s.pic || '',
      duration: s.duration ? parseInt(s.duration) : undefined,
    })),
  }
}

// ---- Kugou Board Fetcher ----
// API: http://mobilecdnbj.kugou.com/api/v3/rank/song
async function fetchKgBoard(bangid: string, page: number, limit: number): Promise<{ items: ChartSongItem[]; total: number }> {
  const resp = await fetch(
    `/api/kugou/api/v3/rank/song?version=9108&ranktype=1&plat=0&pagesize=${limit}&area_code=1&page=${page}&rankid=${bangid}&with_res_tag=0&show_portrait_mv=1`
  )
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.errcode != 0) throw new Error(data.errcode?.toString())

  const list = data?.data?.info || []
  return {
    total: data?.data?.total || list.length,
    items: list.map((s: any) => ({
      id: s.hash || (s.audio_id || '').toString() || '',
      source: 'kg' as MusicSource,
      name: s.songname || '',
      singer: s.authors?.map((a: any) => a.author_name).join('、') || s.singername || '',
      album: s.remark || s.album_name || '',
      albumPic: s.img || '',
      duration: s.duration ? Math.round(s.duration) : undefined,
      hash: s.hash,
    })),
  }
}

// ---- QQ Music Board Fetcher ----
// API: https://u.y.qq.com/cgi-bin/musicu.fcg (POST)
async function fetchTxBoard(bangid: string, _page: number, limit: number): Promise<{ items: ChartSongItem[]; total: number }> {
  const resp = await fetch('/api/qqmusic/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      toplist: {
        module: 'musicToplist.ToplistInfoServer',
        method: 'GetDetail',
        param: { topid: parseInt(bangid), num: limit, period: '' },
      },
      comm: { uin: 0, format: 'json', ct: 20, cv: 1859 },
    }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.code !== 0) throw new Error(data.code?.toString())

  const songList = data?.toplist?.data?.data?.song || []
  return {
    total: songList.length,
    items: songList.map((s: any) => ({
      id: (s.songId || s.mid || '').toString(),
      source: 'tx' as MusicSource,
      name: s.title || s.name || '',
      singer: s.singerName || '',
      album: s.albumName || '',
      albumPic: s.cover || s.albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albumMid}.jpg` : '',
      duration: s.interval || undefined,
      songmid: s.mid || s.songMid || '',
    })),
  }
}

// ---- Netease Board Fetcher ----
// API: https://music.163.com/weapi/v3/playlist/detail (POST with weapi crypto — simplified via proxy)
async function fetchWyBoard(bangid: string, _page: number, limit: number): Promise<{ items: ChartSongItem[]; total: number }> {
  // Use the simpler non-encrypted endpoint via proxy
  const resp = await fetch(`/api/netease/api/v6/playlist/detail?id=${bangid}&n=${limit}&s=0`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.code !== 200) throw new Error(data.code?.toString())

  const tracks = data?.playlist?.tracks || []
  return {
    total: data?.playlist?.trackCount || tracks.length,
    items: tracks.map((t: any) => ({
      id: (t.id || '').toString(),
      source: 'wy' as MusicSource,
      name: t.name || '',
      singer: t.ar?.map((a: any) => a.name).join('/') || '',
      album: t.al?.name || '',
      albumPic: t.al?.picUrl || '',
      duration: t.dt ? Math.round(t.dt / 1000) : undefined,
    })),
  }
}

// ---- Migu Board Fetcher ----
// API: https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querycontentbyId.do
async function fetchMgBoard(bangid: string, _page: number, limit: number): Promise<{ items: ChartSongItem[]; total: number }> {
  const resp = await fetch(
    `/api/migu/MIGUM2.0/v1.0/content/querycontentbyId.do?columnId=${bangid}&needAll=0&pageSize=${limit}`,
    {
      headers: {
        'Referer': 'https://app.c.nf.migu.cn/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36',
      },
    }
  )
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.code !== '000000') throw new Error(data.code)

  const contents = data?.columnInfo?.contents || []
  const items: ChartSongItem[] = contents.map((m: any) => {
    const info = m.objectInfo || m
    return {
      id: info.copyrightId || info.id || '',
      source: 'mg' as MusicSource,
      name: info.songName || info.name || '',
      singer: info.singerName || info.singer || '',
      album: info.albumName || info.album || '',
      albumPic: info.cover || info.img || '',
      duration: info.duration ? Math.round(info.duration) : (info.interval ? Math.round(info.interval) : undefined),
    }
  })

  return {
    total: items.length,
    items,
  }
}

/**
 * Convert chart song item to Track for playback
 */
export function chartItemToTrack(item: ChartSongItem): Track {
  return {
    id: `chart_${item.source}_${item.id}_${Date.now()}`,
    title: item.name,
    artist: item.singer,
    album: item.album,
    cover: item.albumPic,
    duration: item.duration,
    url: '',
    source: item.source,
    sourceId: item.id,
    songmid: item.songmid || item.id,
    hash: item.hash,
  }
}

// ===== Song List / Playlist API (from LX Music source) =====
// Path: src/renderer/utils/musicSdk/{kw,kg}/songList.js

export interface SongListTag {
  id: string
  name: string
  parentId?: string
  parentName?: string
}

export interface SongListItem {
  id: string
  name: string
  author: string
  playCount: string
  total: number
  img: string
  grade?: number
  desc?: string
  source: MusicSource
}

export interface SongListDetailInfo {
  name: string
  img: string
  desc: string
  author: string
  playCount: string
}

export interface SongListTagsResult {
  tags: SongListTag[][]
  hotTag: SongListTag[]
  source: MusicSource
}

/**
 * Fetch song list tags for a source
 */
export async function fetchSongListTags(source: MusicSource): Promise<SongListTagsResult | null> {
  const fetcher = SONGLIST_TAG_FETCHERS[source]
  if (!fetcher) return null
  try {
    return await fetcher()
  } catch (e) {
    console.warn(`[SourceResolver] SongList tags fetch failed for ${source}:`, e)
    return null
  }
}

/**
 * Fetch song list (paginated) for a source
 */
export async function fetchSongList(
  source: MusicSource,
  sortId: string,
  tagId: string | null,
  page: number = 1
): Promise<{ list: SongListItem[]; total: number } | null> {
  const fetcher = SONGLIST_FETCHERS[source]
  if (!fetcher) return null
  try {
    return await fetcher(sortId, tagId, page)
  } catch (e) {
    console.warn(`[SourceResolver] SongList fetch failed for ${source}:`, e)
    return null
  }
}

/**
 * Fetch song list detail (songs inside a playlist)
 */
export async function fetchSongListDetail(
  source: MusicSource,
  listId: string,
  page: number = 1
): Promise<{ items: ChartSongItem[]; info?: SongListDetailInfo; total: number } | null> {
  const fetcher = SONGLIST_DETAIL_FETCHERS[source]
  if (!fetcher) return null
  try {
    return await fetcher(listId, page)
  } catch (e) {
    console.warn(`[SourceResolver] SongList detail fetch failed for ${source}:`, e)
    return null
  }
}

/**
 * Search song lists (playlists)
 */
export async function searchSongList(
  source: MusicSource,
  text: string,
  page: number = 1,
  limit: number = 20
): Promise<{ list: SongListItem[]; total: number } | null> {
  const fetcher = SONGLIST_SEARCH_FETCHERS[source]
  if (!fetcher) return null
  try {
    return await fetcher(text, page, limit)
  } catch (e) {
    console.warn(`[SourceResolver] SongList search failed for ${source}:`, e)
    return null
  }
}

type TagFetcher = () => Promise<SongListTagsResult>
type SongListFetcher = (sortId: string, tagId: string | null, page: number) => Promise<{ list: SongListItem[]; total: number }>
type SongListDetailFetcher = (listId: string, page: number) => Promise<{ items: ChartSongItem[]; info?: SongListDetailInfo; total: number }>
type SongListSearchFetcher = (text: string, page: number, limit: number) => Promise<{ list: SongListItem[]; total: number }>

const SONGLIST_TAG_FETCHERS: Record<string, TagFetcher> = {
  kw: fetchKwSongListTags,
  kg: fetchKgSongListTags,
}

const SONGLIST_FETCHERS: Record<string, SongListFetcher> = {
  kw: fetchKwSongList,
  kg: fetchKgSongList,
}

const SONGLIST_DETAIL_FETCHERS: Record<string, SongListDetailFetcher> = {
  kw: fetchKwSongListDetail,
  kg: fetchKgSongListDetail,
}

const SONGLIST_SEARCH_FETCHERS: Record<string, SongListSearchFetcher> = {
  kw: searchKwSongList,
}

// ---- Kuwo SongList ----
// API tags: http://wapi.kuwo.cn/api/pc/classify/playlist/getTagList
// API list: http://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList
// API detail: http://nplserver.kuwo.cn/pl.svc?op=getlistinfo
async function fetchKwSongListTags(): Promise<SongListTagsResult> {
  const [tagsResp, hotResp] = await Promise.all([
    fetch('/api/kuwo-tag/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0&vipver=9.0.5.0&source=kwplayer_pc_9.0.5.0&loginUid=0&loginSid=0&appUid=76039576'),
    fetch('/api/kuwo-tag/api/pc/classify/playlist/getRcmTagList?loginUid=0&loginSid=0&appUid=76039576'),
  ])
  const tagsData = await tagsResp.json()
  const hotData = await hotResp.json()

  const tags: SongListTag[][] = (tagsData?.data || []).map((type: any) => ({
    name: type.name,
    list: (type.data || []).map((item: any) => ({
      id: `${item.id}-${item.digest}`,
      name: item.name,
      parentId: type.id?.toString(),
      parentName: type.name,
      source: 'kw' as MusicSource,
    })),
  }))

  const hotTag: SongListTag[] = (hotData?.data?.[0]?.data || []).map((item: any) => ({
    id: `${item.id}-${item.digest}`,
    name: item.name,
    source: 'kw' as MusicSource,
  }))

  return { tags, hotTag, source: 'kw' }
}

async function fetchKwSongList(sortId: string, tagId: string | null, page: number): Promise<{ list: SongListItem[]; total: number }> {
  let id: string | null = null
  let type: string | null = null
  if (tagId) {
    const arr = tagId.split('-')
    id = arr[0]
    type = arr[1]
  }

  let url: string
  if (!id) {
    url = `http://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?loginUid=0&loginSid=0&appUid=76039576&&pn=${page}&rn=36&order=${sortId}`
  } else if (type === '10000') {
    url = `http://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?loginUid=0&loginSid=0&appUid=76039576&pn=${page}&id=${id}&rn=36`
  } else {
    url = `http://mobileinterfaces.kuwo.cn/er.s?type=get_pc_qz_data&f=web&id=${id}&prod=pc`
  }

  // Use CORS proxy for wapi.kuwo.cn and mobileinterfaces.kuwo.cn
  const resp = await fetch('/api/cors-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const body = await resp.json()

  if (body.code !== 200) throw new Error(body.msg)
  const rawList = body.data?.data || body
  const listData = Array.isArray(rawList) ? rawList : []

  const formatPlayCount = (num: number) => {
    if (num > 100000000) return parseInt(String(num / 10000000)) / 10 + '亿'
    if (num > 10000) return parseInt(String(num / 1000)) / 10 + '万'
    return String(num)
  }

  return {
    total: body.data?.total || listData.length,
    list: listData.map((item: any) => ({
      id: `digest-${item.digest}__${item.id}`,
      name: item.name,
      author: item.uname || '',
      playCount: formatPlayCount(item.listencnt || 0),
      total: item.total || 0,
      img: item.img || '',
      grade: item.favorcnt ? item.favorcnt / 10 : undefined,
      desc: item.desc || '',
      source: 'kw' as MusicSource,
    })),
  }
}

async function fetchKwSongListDetail(listId: string, page: number): Promise<{ items: ChartSongItem[]; info?: SongListDetailInfo; total: number }> {
  let id = listId
  if ((/[?&:/]/.test(id))) {
    const m = id.match(/playlist(?:_detail)?\/(\d+)/)
    if (m) id = m[1]
  } else if (/^digest-/.test(id)) {
    const parts = id.split('__')
    id = parts[1] || ''
  }

  const url = `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${id}&pn=${page - 1}&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1`
  const resp = await fetch('/api/cors-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.result !== 'ok') throw new Error('failed')

  const formatPlayCount = (num: number) => {
    if (num > 100000000) return parseInt(String(num / 10000000)) / 10 + '亿'
    if (num > 10000) return parseInt(String(num / 1000)) / 10 + '万'
    return String(num)
  }

  const decodeName = (str: string) => {
    try { return decodeURIComponent(escape(str)) } catch { return str }
  }

  const items = (data.musiclist || []).map((s: any) => ({
    id: (s.id || '').toString(),
    source: 'kw' as MusicSource,
    name: decodeName(s.name || ''),
    singer: decodeName(s.artist || ''),
    album: decodeName(s.album || ''),
    albumPic: s.pic || '',
    duration: s.duration ? Math.round(s.duration) : undefined,
  }))

  return {
    total: data.total || items.length,
    items,
    info: {
      name: data.title || '',
      img: data.pic || '',
      desc: data.info || '',
      author: data.uname || '',
      playCount: formatPlayCount(data.playnum || 0),
    },
  }
}

async function searchKwSongList(text: string, page: number, limit: number): Promise<{ list: SongListItem[]; total: number }> {
  const url = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(text)}&pn=${page - 1}&rn=${limit}&rformat=json&encoding=utf8&ver=mbox&vipver=MUSIC_8.7.7.0_BCS37&plat=pc&devid=28156413&ft=playlist&pay=0&needliveshow=0`
  const resp = await fetch('/api/cors-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const textBody = await resp.text()

  // Kuwo returns a special format: key=value&key=value
  const data: any = {}
  const matches = textBody.match(/(\w+)=([^&$]*)/g) || []
  for (const m of matches) {
    const [k, ...rest] = m.split('=')
    data[k] = rest.join('=')
  }

  const formatPlayCount = (num: number) => {
    if (num > 100000000) return parseInt(String(num / 10000000)) / 10 + '亿'
    if (num > 10000) return parseInt(String(num / 1000)) / 10 + '万'
    return String(num)
  }

  const decodeName = (str: string) => {
    try { return decodeURIComponent(escape(str)) } catch { return str }
  }

  let abslist: any[] = []
  try {
    abslist = JSON.parse((data.abslist || '[]').replace(/'/g, '"'))
  } catch { /* ignore */ }

  return {
    total: parseInt(data.TOTAL) || abslist.length,
    list: abslist.map((item: any) => ({
      id: String(item.playlistid),
      name: decodeName(item.name || ''),
      author: decodeName(item.nickname || ''),
      playCount: formatPlayCount(item.playcnt || 0),
      total: item.songnum || 0,
      img: item.pic || '',
      desc: decodeName(item.intro || ''),
      source: 'kw' as MusicSource,
    })),
  }
}

// ---- Kugou SongList ----
// API tags: https://mobilecdnbj.kugou.com/api/v5/rank/list (reuse for tags)
// Simplified — Kugou songList API is more complex (requires signature), use search instead
async function fetchKgSongListTags(): Promise<SongListTagsResult> {
  // Kugou tags API requires app signature, use simplified static tags
  const tags: SongListTag[][] = [
    {
      name: '语种',
      list: [
        { id: '1', name: '华语', source: 'kg' as MusicSource },
        { id: '2', name: '欧美', source: 'kg' as MusicSource },
        { id: '3', name: '日语', source: 'kg' as MusicSource },
        { id: '4', name: '韩语', source: 'kg' as MusicSource },
        { id: '5', name: '粤语', source: 'kg' as MusicSource },
      ],
    },
    {
      name: '风格',
      list: [
        { id: '6', name: '流行', source: 'kg' as MusicSource },
        { id: '7', name: '摇滚', source: 'kg' as MusicSource },
        { id: '8', name: '民谣', source: 'kg' as MusicSource },
        { id: '9', name: '电子', source: 'kg' as MusicSource },
        { id: '10', name: '说唱', source: 'kg' as MusicSource },
        { id: '11', name: 'R&B', source: 'kg' as MusicSource },
        { id: '12', name: '轻音乐', source: 'kg' as MusicSource },
        { id: '13', name: '古风', source: 'kg' as MusicSource },
      ],
    },
    {
      name: '场景',
      list: [
        { id: '14', name: '学习', source: 'kg' as MusicSource },
        { id: '15', name: '工作', source: 'kg' as MusicSource },
        { id: '16', name: '运动', source: 'kg' as MusicSource },
        { id: '17', name: '助眠', source: 'kg' as MusicSource },
        { id: '18', name: '派对', source: 'kg' as MusicSource },
      ],
    },
  ]
  return { tags, hotTag: tags[0]?.list || [], source: 'kg' }
}

async function fetchKgSongList(_sortId: string, _tagId: string | null, _page: number): Promise<{ list: SongListItem[]; total: number }> {
  // Kugou songList browsing requires complex signature (infSign vendor)
  // Fallback: return empty, user can search instead
  return { list: [], total: 0 }
}

async function fetchKgSongListDetail(listId: string, page: number): Promise<{ items: ChartSongItem[]; info?: SongListDetailInfo; total: number }> {
  // Kugou uses specialid for songList detail
  const url = `http://mobilecdnbj.kugou.com/api/v3/special/song?version=9108&plat=0&specialid=${listId}&pagesize=100&page=${page}`
  const resp = await fetch('/api/cors-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (data.errcode !== 0) throw new Error(data.errcode?.toString())

  const items = (data?.data?.info || []).map((s: any) => ({
    id: s.hash || (s.audio_id || '').toString() || '',
    source: 'kg' as MusicSource,
    name: s.songname || '',
    singer: s.singername || '',
    album: s.album_name || '',
    albumPic: s.img || '',
    duration: s.duration ? Math.round(s.duration) : undefined,
    hash: s.hash,
  }))

  return { total: items.length, items }
}

/**
 * Convert song list item to a routable ID
 */
export function songListItemToRouteId(item: SongListItem): string {
  return `${item.source}__${item.id}`
}

// ===== Fallback Lyric API =====

async function fetchLyricFromPublicApi(musicInfo: LxMusicInfo): Promise<SourceLyricResult | null> {
  const source = musicInfo.source
  const id = musicInfo.songmid || musicInfo.id

  try {
    // Try Kuwo lyrics (mobile API, no auth needed)
    if ((source === 'kw') && id) {
      const resp = await fetch(`/api/kuwo-m/newh5/singles/songinfoandlrc?musicId=${id}&httpsStatus=1`)
      const data = await resp.json()
      if (data?.data?.lrclist?.length) {
        const lrc = data.data.lrclist
          .map((item: { lineLyric: string; time: string }) => {
            const minutes = Math.floor(parseFloat(item.time) / 60)
            const seconds = parseFloat(item.time) % 60
            const ts = `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`
            return `[${ts}]${item.lineLyric}`
          })
          .join('\n')
        return { lyric: lrc }
      }
    }

    // Try Netease lyrics (they're usually available without auth)
    if (source === 'wy' && id) {
      const resp = await fetch(`/api/netease/api/song/lyric?id=${id}&lv=1&tv=1`)
      const data = await resp.json()
      if (data?.lrc?.lyric) {
        return {
          lyric: data.lrc.lyric,
          tlyric: data.tlyric?.lyric || undefined,
        }
      }
    }

    // Try QQ Music lyrics
    if (source === 'tx' && id) {
      const resp = await fetch(`/api/qqmusic/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${id}&format=json`)
      const data = await resp.json()
      if (data?.lyric) {
        const lyric = decodeBase64(data.lyric)
        const tlyric = data.tlyric ? decodeBase64(data.tlyric) : undefined
        return { lyric, tlyric }
      }
    }
  } catch (e) {
    console.warn('[SourceResolver] Public lyric fetch failed:', e)
  }

  return null
}

function decodeBase64(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str)))
  } catch {
    return ''
  }
}

// ===== Helper =====

function getNextAvailableSource(
  current: MusicSource,
  plugins: ParsedSourcePlugin[],
  tried: Set<MusicSource>
): MusicSource | null {
  // Collect all available sources from enabled plugins
  const availableSources = new Set<MusicSource>()
  for (const plugin of plugins) {
    if (!plugin.enabled) continue
    for (const src of plugin.sources) {
      if (!tried.has(src)) {
        availableSources.add(src)
      }
    }
  }

  if (availableSources.size === 0) return null

  // Priority order
  const priority: MusicSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']
  for (const src of priority) {
    if (availableSources.has(src)) return src
  }
  return availableSources.values().next().value || null
}
