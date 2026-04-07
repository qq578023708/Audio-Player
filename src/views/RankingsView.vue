<template>
  <div class="rankings-view">
    <div class="page-header">
      <h1 class="page-title">
        <SvgIcon name="trending-up" :size="22" />
        排行榜
      </h1>
      <div class="page-header-actions" v-if="hasNoPlugins">
        <button class="source-hint-btn" @click="$router.push('/source')">
          <SvgIcon name="settings" :size="14" />
          导入音源后才能播放
        </button>
      </div>
    </div>

    <!-- Source tabs -->
    <div class="source-tabs">
      <button
        v-for="src in sourceOptions"
        :key="src.value"
        class="source-tab"
        :class="{ active: activeSource === src.value }"
        @click="switchSource(src.value)"
      >
        <div class="tab-dot" :style="{ background: src.color }" />
        {{ src.label }}
      </button>
    </div>

    <!-- Loading -->
    <div class="loading-state" v-if="isLoading">
      <SvgIcon name="loader" :size="24" class="spinning" />
      <span>正在加载{{ currentSourceName }}排行榜...</span>
    </div>

    <!-- Error -->
    <div class="error-state" v-else-if="errorMsg">
      <SvgIcon name="x" :size="24" />
      <span>{{ errorMsg }}</span>
      <button class="retry-btn" @click="fetchCharts">重试</button>
    </div>

    <!-- Charts -->
    <template v-else>
      <section v-for="chart in charts" :key="chart.id" class="chart-section">
        <div class="chart-header">
          <div class="chart-title-area">
            <div class="chart-cover" :style="{ background: getGradient(chart.id) }">
              <SvgIcon name="trending-up" :size="20" />
            </div>
            <div>
              <h2 class="chart-name">{{ chart.name }}</h2>
              <div class="chart-meta">{{ chart.items.length }} 首歌曲</div>
            </div>
          </div>
          <button class="play-all-btn" @click="playAllChart(chart)" :disabled="chart.items.length === 0 || hasNoPlugins">
            <SvgIcon name="play" :size="14" />
            播放全部
          </button>
        </div>

        <div class="track-list" v-if="chart.items.length > 0">
          <div
            v-for="(item, index) in chart.items.slice(0, 30)"
            :key="`${item.source}_${item.id}`"
            class="track-row"
            :class="{ active: isActiveItem(item) }"
            @dblclick="playChartItem(item)"
          >
            <div class="rank-num" :class="{ top3: index < 3 }">
              {{ index + 1 }}
            </div>
            <div class="track-cover-wrap" @click="playChartItem(item)">
              <img
                v-if="item.albumPic"
                :src="item.albumPic"
                :alt="item.name"
                class="track-cover-img"
                loading="lazy"
                @error="($event.target as HTMLImageElement).style.display='none'"
              />
              <div v-if="!item.albumPic" class="track-cover-placeholder" :style="{ background: getGradient(item.id) }">
                <SvgIcon name="music" :size="14" />
              </div>
              <div class="play-overlay">
                <SvgIcon v-if="isActiveItem(item) && player.isPlaying.value" name="volume-high" :size="14" />
                <SvgIcon v-else name="play" :size="14" />
              </div>
            </div>
            <div class="track-info">
              <div class="track-title">{{ item.name }}</div>
              <div class="track-artist">{{ item.singer }}</div>
            </div>
            <div class="track-album" v-if="item.album">{{ item.album }}</div>
            <div class="track-duration" v-if="item.duration">{{ formatTime(item.duration) }}</div>
            <button class="icon-btn" title="收藏" @click.stop="favoriteChartItem(item)">
              <SvgIcon :name="isFav(item) ? 'heart-filled' : 'heart'" :size="14" />
            </button>
          </div>
        </div>
        <div class="chart-empty" v-else>
          暂无数据
        </div>
      </section>
    </template>

    <!-- Resolving status -->
    <div class="resolve-bar" v-if="player.isResolving.value">
      <SvgIcon name="loader" :size="14" class="spinning" />
      <span>{{ player.resolveStatus.value }}</span>
    </div>
    <div class="resolve-bar error" v-else-if="player.error.value && !player.isLoading.value">
      <span>{{ player.error.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'
import { useSourceStore } from '@/stores/source'
import { fetchChartList, chartItemToTrack, type ChartData, type ChartSongItem } from '@/services/sourceResolver'
import type { MusicSource } from '@/types'

const player = useAudioPlayer()
const store = usePlaylistStore()
const sourceStore = useSourceStore()

const activeSource = ref<MusicSource>('kw')
const isLoading = ref(false)
const errorMsg = ref('')
const charts = ref<ChartData[]>([])

const hasNoPlugins = computed(() => sourceStore.enabledPlugins.length === 0)

const currentSourceName = computed(() => {
  const map: Record<string, string> = { kw: '酷我', kg: '酷狗', tx: 'QQ音乐', wy: '网易云', mg: '咪咕' }
  return map[activeSource.value] || ''
})

const sourceOptions = [
  { value: 'kw' as MusicSource, label: '酷我', color: '#ff6a00' },
  { value: 'kg' as MusicSource, label: '酷狗', color: '#2196f3' },
  { value: 'tx' as MusicSource, label: 'QQ音乐', color: '#31c27c' },
  { value: 'wy' as MusicSource, label: '网易云', color: '#e60026' },
  { value: 'mg' as MusicSource, label: '咪咕', color: '#ff2d55' },
]

const gradients = [
  'linear-gradient(135deg, #ff6a00, #ff2d55)',
  'linear-gradient(135deg, #5b8cff, #8b5cf6)',
  'linear-gradient(135deg, #30d158, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
]

function getGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}

function switchSource(source: MusicSource) {
  activeSource.value = source
  charts.value = []
  fetchCharts()
}

async function fetchCharts() {
  isLoading.value = true
  errorMsg.value = ''
  charts.value = []

  try {
    const result = await fetchChartList(activeSource.value, 'hot')
    if (result.length === 0) {
      errorMsg.value = `${currentSourceName.value}排行榜加载失败，可能是网络问题或 CORS 限制`
    } else {
      charts.value = result
    }
  } catch (e: any) {
    errorMsg.value = `加载失败: ${e.message || '网络错误'}`
  }

  isLoading.value = false
}

function isActiveItem(item: ChartSongItem): boolean {
  const ct = player.currentTrack.value
  if (!ct) return false
  return ct.source === item.source && ct.sourceId === item.id
}

function isFav(item: ChartSongItem): boolean {
  return store.favorites.some(f =>
    f.source === item.source && f.sourceId === item.id
  )
}

function favoriteChartItem(item: ChartSongItem) {
  const track = chartItemToTrack(item)
  store.toggleFavorite(track)
}

async function playChartItem(item: ChartSongItem) {
  if (hasNoPlugins.value) {
    player.error.value = '请先在"音源管理"页面导入并启用音源插件'
    return
  }

  const track = chartItemToTrack(item)
  player.addToPlaylist(track)
  const idx = player.playlist.value.length - 1
  player.currentIndex.value = idx
  await player.loadAndPlay(track)
}

async function playAllChart(chart: ChartData) {
  if (chart.items.length === 0 || hasNoPlugins.value) return

  const tracks = chart.items.slice(0, 30).map((item, i) => ({
    ...chartItemToTrack(item),
    id: `chart_${chart.id}_${item.id}_${i}`,
  }))

  player.setPlaylist(tracks)
  player.playTrack(0)
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

onMounted(() => {
  fetchCharts()
})
</script>

<style scoped>
.rankings-view {
  padding: 24px;
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
}

.source-hint-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.source-hint-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.source-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.source-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.source-tab:hover {
  border-color: var(--border-light);
}

.source-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--text-muted);
}

.error-state {
  color: var(--danger);
}

.retry-btn {
  margin-top: 8px;
  padding: 8px 20px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: all var(--transition-fast);
}

.retry-btn:hover {
  background: var(--accent-hover);
}

.chart-section {
  margin-bottom: 32px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.chart-title-area {
  display: flex;
  align-items: center;
  gap: 14px;
}

.chart-cover {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
}

.chart-name {
  font-size: 17px;
  font-weight: 600;
}

.chart-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.play-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.play-all-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.play-all-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.track-list {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.track-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  transition: background var(--transition-fast);
}

.track-row:hover {
  background: var(--bg-hover);
}

.track-row.active {
  background: var(--accent-subtle);
}

.rank-num {
  width: 24px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  color: var(--text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.rank-num.top3 {
  color: var(--accent);
}

.track-cover-wrap {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  cursor: pointer;
  overflow: hidden;
}

.track-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.track-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.track-cover-wrap:hover .play-overlay {
  opacity: 1;
}

.track-row.active .play-overlay {
  opacity: 1;
  background: rgba(0, 0, 0, 0.2);
}

.track-row.active .play-overlay svg {
  color: var(--accent);
  animation: pulse 1.5s ease-in-out infinite;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-row.active .track-title {
  color: var(--accent);
}

.track-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  width: 120px;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.track-duration {
  width: 42px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
  flex-shrink: 0;
  font-family: var(--font-mono);
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-muted);
  transition: all var(--transition-fast);
  opacity: 0;
  flex-shrink: 0;
}

.track-row:hover .icon-btn {
  opacity: 1;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--accent-secondary);
}

.chart-empty {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* Resolve status bar */
.resolve-bar {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: var(--radius-md);
  font-size: 13px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.resolve-bar.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 768px) {
  .rankings-view { padding: 16px; }
  .track-album { display: none; }
  .icon-btn { opacity: 1; }
}
</style>
