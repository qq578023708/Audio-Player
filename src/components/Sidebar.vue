<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">
        <SvgIcon name="headphones" :size="22" />
      </div>
      <span class="logo-text">AudioFlow</span>
    </div>

    <!-- Search -->
    <div class="sidebar-search">
      <div class="search-box">
        <SvgIcon name="search" :size="16" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索音乐..."
          @keydown.enter="$router.push({ name: 'discover', query: { q: searchQuery } })"
        />
      </div>
    </div>

    <!-- Nav items -->
    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-label">在线音乐</div>
        <router-link
          to="/"
          class="nav-item"
          :class="{ active: $route.path === '/' }"
        >
          <SvgIcon name="compass" :size="18" />
          <span>发现音乐</span>
        </router-link>
        <router-link
          to="/rankings"
          class="nav-item"
          :class="{ active: $route.path === '/rankings' }"
        >
          <SvgIcon name="trending-up" :size="18" />
          <span>排行榜</span>
        </router-link>
        <router-link
          to="/playlist"
          class="nav-item"
          :class="{ active: $route.path === '/playlist' }"
        >
          <SvgIcon name="list-music" :size="18" />
          <span>播放列表</span>
          <span class="nav-badge" v-if="player.playlist.value.length">
            {{ player.playlist.value.length }}
          </span>
        </router-link>
        <router-link to="/add-url" class="nav-item" :class="{ active: $route.path === '/add-url' }">
          <SvgIcon name="link" :size="18" />
          <span>添加音乐</span>
        </router-link>
      </div>

      <div class="nav-section">
        <div class="nav-label">我的音乐</div>
        <router-link
          to="/now-playing"
          class="nav-item"
          :class="{ active: $route.path === '/now-playing' }"
        >
          <SvgIcon name="disc" :size="18" :class="{ spinning: player.isPlaying.value }" />
          <span>正在播放</span>
        </router-link>
        <router-link
          to="/favorites"
          class="nav-item"
          :class="{ active: $route.path === '/favorites' }"
        >
          <SvgIcon name="heart" :size="18" class="heart-icon" />
          <span>我的收藏</span>
          <span class="nav-badge" v-if="store.favorites.length">
            {{ store.favorites.length }}
          </span>
        </router-link>
        <router-link
          to="/history"
          class="nav-item"
          :class="{ active: $route.path === '/history' }"
        >
          <SvgIcon name="clock" :size="18" />
          <span>播放历史</span>
        </router-link>
        <router-link
          to="/source"
          class="nav-item"
          :class="{ active: $route.path === '/source' }"
        >
          <SvgIcon name="sliders" :size="18" />
          <span>音源管理</span>
        </router-link>
        <router-link
          to="/settings"
          class="nav-item"
          :class="{ active: $route.path === '/settings' }"
        >
          <SvgIcon name="settings" :size="18" />
          <span>系统设置</span>
        </router-link>
      </div>

      <div class="nav-section">
        <div class="nav-label">
          <span>我的歌单</span>
          <button class="nav-add-btn" title="创建歌单" @click="showCreateFolder = true">
            <SvgIcon name="plus" :size="14" />
          </button>
        </div>
        <TransitionGroup name="slide-fade" tag="div">
          <router-link
            v-for="folder in store.folders"
            :key="folder.id"
            :to="`/folder/${folder.id}`"
            class="nav-item sub"
            :class="{ active: $route.params.id === folder.id }"
          >
            <SvgIcon name="folder" :size="16" />
            <span class="nav-ellipsis">{{ folder.name }}</span>
            <span class="nav-badge small">{{ folder.tracks.length }}</span>
          </router-link>
        </TransitionGroup>
        <div class="nav-empty" v-if="store.folders.length === 0">
          暂无歌单
        </div>
      </div>
    </nav>

    <!-- Create folder dialog -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showCreateFolder" @click.self="showCreateFolder = false">
        <div class="modal-content">
          <h3 class="modal-title">创建歌单</h3>
          <div class="modal-body">
            <div class="form-group">
              <label>歌单名称</label>
              <input v-model="newFolderName" placeholder="输入歌单名称..." autofocus @keydown.enter="handleCreateFolder" />
            </div>
            <div class="form-group">
              <label>描述（可选）</label>
              <input v-model="newFolderDesc" placeholder="简要描述..." />
            </div>
            <div class="form-group">
              <label>分类</label>
              <select v-model="newFolderCategory">
                <option value="">未分类</option>
                <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button class="modal-btn cancel" @click="showCreateFolder = false">取消</button>
            <button class="modal-btn confirm" @click="handleCreateFolder" :disabled="!newFolderName.trim()">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { usePlaylistStore } from '@/stores/playlist'

const player = useAudioPlayer()
const store = usePlaylistStore()
const searchQuery = ref('')
const showCreateFolder = ref(false)
const newFolderName = ref('')
const newFolderDesc = ref('')
const newFolderCategory = ref('')

function handleCreateFolder() {
  if (!newFolderName.value.trim()) return
  store.createFolder(newFolderName.value.trim(), newFolderDesc.value.trim() || undefined, newFolderCategory.value || undefined)
  newFolderName.value = ''
  newFolderDesc.value = ''
  newFolderCategory.value = ''
  showCreateFolder.value = false
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.logo-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar-search {
  padding: 12px 12px 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 7px 12px;
  transition: all var(--transition-fast);
}

.search-box:focus-within {
  background: var(--bg-hover);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.search-box svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.search-box input::placeholder {
  color: var(--text-muted);
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 16px;
}

.nav-section {
  margin-bottom: 4px;
}

.nav-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-add-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.nav-add-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.nav-item.sub {
  padding: 7px 12px 7px 20px;
  gap: 8px;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.nav-item.active .heart-icon {
  color: var(--accent-secondary);
}

.nav-ellipsis {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  flex-shrink: 0;
}

.nav-badge.small {
  font-size: 10px;
  padding: 0 5px;
}

.nav-item.active .nav-badge {
  background: var(--accent-glow);
  color: var(--accent);
}

.nav-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.6;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  padding: 24px;
  width: 380px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  transition: border-color var(--transition-fast);
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--accent);
}

.form-group select {
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-btn {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.modal-btn.cancel {
  color: var(--text-secondary);
}

.modal-btn.cancel:hover {
  background: var(--bg-hover);
}

.modal-btn.confirm {
  background: var(--accent);
  color: #fff;
}

.modal-btn.confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.modal-btn.confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -260px;
    top: 0;
    bottom: var(--player-bar-height);
    z-index: 200;
    transition: left var(--transition-normal);
    box-shadow: var(--shadow-lg);
  }

  .sidebar.open {
    left: 0;
  }
}
</style>
