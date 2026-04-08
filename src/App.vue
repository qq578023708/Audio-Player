<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'
import Sidebar from './components/Sidebar.vue'
import PlayerBar from './components/PlayerBar.vue'
import TitleBar from './components/TitleBar.vue'
import SvgIcon from './components/SvgIcon.vue'
import { useRoute, type RouteMeta } from 'vue-router'

// Extend RouteMeta to include transition
declare module 'vue-router' {
  interface RouteMeta {
    transition?: string
  }
}

const player = useAudioPlayer()
const store = usePlaylistStore()
const showRightPanel = ref(false)
const mobileMenuOpen = ref(false)
const route = useRoute()

// Views to keep alive (preserve state when navigating away)
const cachedViews = ref([
  'discover',
  'playlist',
  'favorites',
  'history',
  'rankings',
  'source',
])

// Close mobile sidebar on route change
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

    switch (e.code) {
      case 'Space':
        e.preventDefault()
        player.togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        player.seek(Math.max(0, player.currentTime.value - 5))
        break
      case 'ArrowRight':
        e.preventDefault()
        player.seek(Math.min(player.duration.value, player.currentTime.value + 5))
        break
      case 'ArrowUp':
        e.preventDefault()
        player.setVolume(player.volume.value + 0.05)
        break
      case 'ArrowDown':
        e.preventDefault()
        player.setVolume(player.volume.value - 0.05)
        break
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    player.destroy()
  })
})

// Watch current track and add to history
watch(() => player.currentTrack.value, (track) => {
  if (track) {
    store.addToHistory(track)
  }
})
</script>

<template>
  <div class="app-layout">
    <!-- Custom titlebar (Electron frameless window) -->
    <TitleBar />

    <!-- Sidebar -->
    <Sidebar :class="{ open: mobileMenuOpen }" />

    <!-- Mobile sidebar overlay -->
    <div class="sidebar-overlay" v-if="mobileMenuOpen" @click="mobileMenuOpen = false"></div>

    <!-- Main content area -->
    <div class="main-area">
      <!-- Mobile header -->
      <header class="mobile-header">
        <button class="menu-btn" @click="mobileMenuOpen = !mobileMenuOpen">
          <SvgIcon name="playlist" :size="20" />
        </button>
        <span class="mobile-title">AudioFlow</span>
        <button class="menu-btn" @click="showRightPanel = !showRightPanel">
          <SvgIcon name="chevron-right" :size="20" />
        </button>
      </header>

      <!-- Page content -->
      <div class="page-content">
        <router-view v-slot="{ Component, route }">
          <transition :name="route.meta.transition || 'page'" mode="out-in">
            <keep-alive :include="cachedViews">
              <component :is="Component" :key="route.path" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </div>

    <!-- Right panel (play queue) -->
    <transition name="slide-panel">
      <aside class="right-panel" v-if="showRightPanel">
        <div class="panel-header">
          <h3 class="panel-title">
            <SvgIcon name="list-music" :size="16" />
            <span>播放队列</span>
            <span class="track-count" v-if="player.playlist.value.length">({{ player.playlist.value.length }})</span>
          </h3>
          <div class="panel-actions">
            <button class="header-btn" title="关闭" @click="showRightPanel = false">
              <SvgIcon name="x" :size="16" />
            </button>
          </div>
        </div>
        <div class="panel-content" v-if="player.playlist.value.length > 0">
          <div
            v-for="(track, index) in player.playlist.value"
            :key="track.id"
            class="queue-item"
            :class="{ active: player.currentTrack.value?.id === track.id }"
            @click="player.playTrack(index)"
          >
            <div class="queue-index">
              <template v-if="player.currentTrack.value?.id === track.id && player.isPlaying.value">
                <div class="playing-indicator"><span /><span /><span /></div>
              </template>
              <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
            </div>
            <div class="queue-info">
              <div class="queue-title">{{ track.title }}</div>
              <div class="queue-artist">{{ track.artist }}</div>
            </div>
            <button class="queue-remove" @click.stop="player.removeFromPlaylist(index)">
              <SvgIcon name="x" :size="12" />
            </button>
          </div>
        </div>
        <div class="panel-empty" v-else>
          <SvgIcon name="music" :size="36" />
          <p>播放队列为空</p>
        </div>
      </aside>
    </transition>

    <!-- Player bar -->
    <PlayerBar @toggle-playlist="showRightPanel = !showRightPanel" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding-top: var(--titlebar-height, 0px);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding-bottom: var(--player-bar-height);
}

/* Mobile header */
.mobile-header {
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: var(--header-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.mobile-title {
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.menu-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.menu-btn:hover {
  background: var(--bg-hover);
}

/* Page content */
.page-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Right panel */
.right-panel {
  width: 320px;
  height: calc(100% - var(--player-bar-height));
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.track-count {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.header-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.queue-item:hover {
  background: var(--bg-hover);
}

.queue-item.active {
  background: var(--accent-subtle);
}

.queue-item.active .queue-title {
  color: var(--accent);
}

.queue-index {
  width: 28px;
  text-align: center;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  flex-shrink: 0;
}

.queue-item.active .queue-index {
  color: var(--accent);
}

.queue-info {
  flex: 1;
  min-width: 0;
}

.queue-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-artist {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-remove {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-muted);
  opacity: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.queue-item:hover .queue-remove {
  opacity: 1;
}

.queue-remove:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.panel-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  padding: 40px;
}

.panel-empty p {
  font-size: 13px;
}

/* Playing indicator */
.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.playing-indicator span {
  display: block;
  width: 2px;
  background: var(--accent);
  border-radius: 1px;
  animation: bar-bounce 0.8s ease-in-out infinite;
}

.playing-indicator span:nth-child(1) { height: 60%; animation-delay: 0s; }
.playing-indicator span:nth-child(2) { height: 100%; animation-delay: 0.2s; }
.playing-indicator span:nth-child(3) { height: 40%; animation-delay: 0.4s; }

@keyframes bar-bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* Slide panel transition */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: all var(--transition-normal);
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  width: 0;
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .right-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: var(--player-bar-height);
    z-index: 150;
    box-shadow: var(--shadow-lg);
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
    backdrop-filter: blur(2px);
  }
}
</style>
