<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { isElectron } from '@/composables/usePlatform'

const settingsStore = useSettingsStore()
const router = useRouter()

const isElectronEnv = computed(() => isElectron())

function goBack() {
  router.back()
}

function openDevTools() {
  if (window.electronAPI?.openDevTools) {
    window.electronAPI.openDevTools()
  }
}

function clearCache() {
  if (confirm('确定要清除所有缓存吗？')) {
    localStorage.clear()
    sessionStorage.clear()
    alert('缓存已清除，建议重启应用')
  }
}
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <button class="back-btn" @click="goBack">
        <SvgIcon name="chevron-left" :size="20" />
        <span>返回</span>
      </button>
      <h1 class="page-title">设置</h1>
    </header>

    <div class="settings-content">
      <!-- Electron Settings -->
      <section class="settings-section" v-if="isElectronEnv">
        <h2 class="section-title">
          <SvgIcon name="monitor" :size="16" />
          <span>桌面端设置</span>
        </h2>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">关闭时最小化到托盘</label>
            <span class="setting-desc">点击关闭按钮时将应用最小化到系统托盘</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="settingsStore.minimizeToTray"
              @change="settingsStore.updateSetting('minimizeToTray', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">开发者工具</label>
            <span class="setting-desc">在独立窗口中打开开发者工具</span>
          </div>
          <button class="action-btn" @click="openDevTools">
            <SvgIcon name="code" :size="14" />
            <span>打开</span>
          </button>
        </div>
      </section>

      <!-- Appearance Settings -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="palette" :size="16" />
          <span>外观</span>
        </h2>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">主题</label>
            <span class="setting-desc">选择应用主题模式</span>
          </div>
          <select
            class="setting-select"
            :value="settingsStore.theme"
            @change="settingsStore.updateSetting('theme', ($event.target as HTMLSelectElement).value as any)"
          >
            <option value="auto">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
      </section>

      <!-- Player Settings -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="play-circle" :size="16" />
          <span>播放</span>
        </h2>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">自动播放</label>
            <span class="setting-desc">添加歌曲后自动开始播放</span>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="settingsStore.autoPlay"
              @change="settingsStore.updateSetting('autoPlay', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </section>

      <!-- Storage Settings -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="database" :size="16" />
          <span>存储</span>
        </h2>

        <div class="setting-item">
          <div class="setting-info">
            <label class="setting-label">清除缓存</label>
            <span class="setting-desc">清除本地存储的所有数据和缓存</span>
          </div>
          <button class="action-btn danger" @click="clearCache">
            <SvgIcon name="trash-2" :size="14" />
            <span>清除</span>
          </button>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="info" :size="16" />
          <span>关于</span>
        </h2>

        <div class="about-content">
          <div class="app-logo">
            <SvgIcon name="music" :size="48" />
          </div>
          <h3 class="app-name">AudioFlow Player</h3>
          <p class="app-version">版本 1.0.0</p>
          <p class="app-desc">跨平台网络音频播放器</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
  border: 1px solid var(--border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.section-title :deep(svg) {
  color: var(--accent);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  gap: 16px;
}

.setting-item:not(:last-child) {
  border-bottom: 1px solid var(--border-subtle);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: 24px;
  transition: background var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* Select */
.setting-select {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  min-width: 120px;
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent);
}

/* Action Button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--accent);
  color: white;
}

.action-btn.danger:hover {
  background: var(--danger);
}

/* About Section */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  gap: 8px;
}

.app-logo {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.app-logo :deep(svg) {
  color: white;
}

.app-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.app-version {
  font-size: 13px;
  color: var(--text-muted);
}

.app-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Responsive */
@media (max-width: 640px) {
  .settings-view {
    padding: 16px;
  }

  .page-title {
    font-size: 20px;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .toggle-switch,
  .setting-select,
  .action-btn {
    align-self: flex-end;
  }
}
</style>
