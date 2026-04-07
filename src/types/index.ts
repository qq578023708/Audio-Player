export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  url: string
  cover?: string
  duration?: number
  isLocal?: boolean
  isFavorite?: boolean
  // Extended fields for multi-source support
  source?: MusicSource      // 音源标识
  sourceId?: string         // 原始平台歌曲ID
  hash?: string             // 酷狗hash
  songmid?: string          // QQ音乐/酷我mid
  strMediaMid?: string      // QQ Music strMediaMid
  lrc?: string              // 歌词LRC文本
  tlyric?: string           // 翻译歌词
}

export interface PlayerState {
  currentTrack: Track | null
  playlist: Track[]
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playMode: 'sequence' | 'loop' | 'shuffle' | 'single'
  isLoading: boolean
  error: string | null
}

export interface PlaylistFolder {
  id: string
  name: string
  description?: string
  cover?: string
  category?: string
  tracks: Track[]
  createdAt: number
  updatedAt: number
}

export interface MusicCategory {
  id: string
  name: string
  icon: string
  color: string
  description?: string
}

export type ViewPage = 'discover' | 'playlist' | 'favorites' | 'history' | 'folder-detail'

// Music source types
export type MusicSource = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'local' | 'url'

export type MusicQuality = '128k' | '320k' | 'flac' | 'flac24bit'

// Source info
export interface SourceInfo {
  source: MusicSource
  name: string           // 显示名称
  icon: string           // 图标
  color: string          // 主题色
  supported: boolean     // 是否启用
  priority: number       // 优先级（越小越优先）
}

// LX Music source plugin (raw from user)
export interface LxSourcePlugin {
  name: string
  version?: string
  sources: MusicSource[]
  qualitys?: MusicQuality[]
  type: 'proxy' | 'direct'
  apiUrl?: string
  code: string            // 源码
}

// Parsed source plugin info
export interface ParsedSourcePlugin {
  name: string
  version: string
  sources: MusicSource[]
  qualitys: MusicQuality[]
  type: 'proxy' | 'direct'
  apiUrl: string
  code: string
  fileName: string
  // Runtime state
  enabled: boolean
  initialized: boolean
  sourceCapabilities: Record<string, LxSourceCapability>
}

// Source capability declared by plugin during init
export interface LxSourceCapability {
  source: MusicSource
  name: string
  type: 'music' | undefined
  actions: string[]        // ['musicUrl', 'lyric', 'pic']
  qualitys: MusicQuality[]
}

// LX Music musicInfo structure
export interface LxMusicInfo {
  id?: string              // songmid / hash
  songmid?: string
  name?: string
  singer?: string
  album?: string
  albumId?: string
  albumPic?: string
  duration?: number        // ms
  source?: MusicSource
  strMediaMid?: string     // QQ Music specific
  copyrightId?: number
  // Other fields
  [key: string]: unknown
}

// Source resolution result
export interface SourceResolveResult {
  url: string
  quality: MusicQuality
  source: MusicSource
  pluginName: string
  // Optional lyrics bundled with the musicUrl response (avoids extra lyric request)
  lyric?: string
  tlyric?: string
  rlyric?: string
  lxlyric?: string
}

// Lyric result from source
export interface SourceLyricResult {
  lyric: string            // LRC text
  tlyric?: string          // translated LRC
  rlyric?: string          // romaji LRC
  lxlyric?: string         // word-by-word LRC
}

// Search result item
export interface SearchTrackItem {
  id: string               // source platform song ID
  source: MusicSource
  name: string
  singer: string
  album: string
  albumPic?: string
  duration?: number        // seconds
  // Platform-specific IDs
  songmid?: string
  hash?: string
  strMediaMid?: string
}

// Lyrics
export interface LyricLine {
  time: number            // 时间（秒）
  text: string            // 歌词文本
  translation?: string   // 翻译
}

export interface LyricsData {
  lines: LyricLine[]
  hasTranslation: boolean
  offset?: number         // 全局时间偏移
}

// Equalizer
export interface EqPreset {
  id: string
  name: string
  gains: number[]         // 10-band gains
}

export interface EqBand {
  frequency: number
  gain: number            // -12 to 12 dB
  Q: number
}

// Chart / Ranking
export interface ChartItem {
  rank: number
  track: Track
  score?: number
  trend?: 'up' | 'down' | 'same' | 'new'
}

export interface ChartInfo {
  id: string
  name: string
  source: MusicSource
  cover?: string
  items: ChartItem[]
  updatedAt: number
}

// Hot artist
export interface HotArtist {
  id: string
  name: string
  avatar?: string
  source: MusicSource
  fanCount?: number
  songCount?: number
}

// Search result
export interface SearchResult {
  tracks: Track[]
  hasMore: boolean
  total?: number
}
