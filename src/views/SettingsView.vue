<template>
  <div class="settings-view">
    <!-- Page Header with Back Button -->
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <SvgIcon name="chevron-left" :size="20" />
        <span>返回</span>
      </button>
      <h1 class="page-title">
        <SvgIcon name="settings" :size="22" />
        设置
      </h1>
      <div class="page-header-spacer"></div>
    </div>

    <!-- Settings Sections -->
    <div class="settings-content">
      <!-- Application Section -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="app" :size="16" />
          应用设置
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">主题</div>
            <div class="setting-desc">选择应用外观主题</div>
          </div>
          <div class="setting-control">
            <select v-model="settings.theme" @change="updateSetting('theme', settings.theme)">
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">显示通知</div>
            <div class="setting-desc">播放新歌曲时显示通知</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="settings.showNotifications"
                @change="updateSetting('showNotifications', settings.showNotifications)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- Playback Section -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="play" :size="16" />
          播放设置
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">自动播放</div>
            <div class="setting-desc">添加歌曲后自动开始播放</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="settings.autoPlay"
                @change="updateSetting('autoPlay', settings.autoPlay)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">记住播放位置</div>
            <div class="setting-desc">重启应用后恢复上次播放进度</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="settings.rememberPlaybackPosition"
                @change="updateSetting('rememberPlaybackPosition', settings.rememberPlaybackPosition)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- Electron Specific Section -->
      <section class="settings-section" v-if="isElectron">
        <h2 class="section-title">
          <SvgIcon name="monitor" :size="16" />
          桌面端设置
        </h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">最小化到托盘</div>
            <div class="setting-desc">点击最小化按钮时隐藏到系统托盘</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="settings.minimizeToTray"
                @change="updateSetting('minimizeToTray', settings.minimizeToTray)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">关闭时最小化</div>
            <div class="setting-desc">点击关闭按钮时最小化到托盘而不是退出</div>
          </div>
          <div class="setting-control">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                v-model="settings.closeToTray"
                @change="updateSetting('closeToTray', settings.closeToTray)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">开发者工具</div>
            <div class="setting-desc">在独立窗口中打开开发者工具</div>
          </div>
          <div class="setting-control">
            <button class="devtools-btn" @click="openDevTools">
              <SvgIcon name="code" :size="14" />
              打开 DevTools
            </button>
          </div>
        </div>
      </section>

      <!-- About Section -->
      <section class="settings-section">
        <h2 class="section-title">
          <SvgIcon name="info" :size="16" />
          关于
        </h2>
        
        <div class="about-content">
          <div class="app-logo">
            <SvgIcon name="headphones" :size="48" />
          </div>
          <div class="app-name">AudioFlow Player</div>
          <div class="app-version">版本 {{ appVersion }}</div>
          <div class="app-platform">
            平台: {{ platformName }}
          </div>
        </div>
      </section>

      <!-- Reset Section -->
      <section class="settings-section">
        <div class="setting-item danger">
          <div class="setting-info">
            <div class="setting-label">重置所有设置</div>
            <div class="setting-desc">将所有设置恢复为默认值</div>
          </div>
          <div class="setting-control">
            <button class="reset-btn" @click="confirmReset">
              <SvgIcon name="refresh-cw" :size="14" />
              重置
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Reset Confirmation Modal -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showResetConfirm" @click.self="showResetConfirm = false">
        <div class="modal-box">
          <h3>确认重置</h3>
          <p>确定要将所有设置恢复为默认值吗？此操作不可撤销。</p>
          <div class="modal-btns">
            <button @click="showResetConfirm = false">取消</button>
            <button class="danger" @click="resetSettings">重置</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/SvgIcon.vue'
import { useSettingsStore } from '@/stores/settings'

defineOptions({
  name: 'settings'
})

const router = useRouter()
const settingsStore = useSettingsStore()

// State
const settings = settingsStore.settings
const showResetConfirm = ref(false)

// Computed
const isElectron = computed(() => settingsStore.isElectron)
const appVersion = ref('1.0.0')

const platformName = computed(() => {
  if (settingsStore.isElectron) return 'Electron (Desktop)'
  if (settingsStore.isCapacitor) {
    const platform = (window as any).Capacitor?.getPlatform?.()
    return `Capacitor (${platform || 'Mobile'})`
  }
  return 'Web'
})

// Methods
function updateSetting<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
  settingsStore.updateSetting(key, value)
}

function confirmReset() {
  showResetConfirm.value = true
}

function resetSettings() {
  settingsStore.resetSettings()
  showResetConfirm.value = false
}

function openDevTools() {
  settingsStore.openDevTools()
}

function goBack() {
  router.back()
}

// Load version from package.json
onMounted(async () => {
  try {
    const pkg = await import('@/../package.json')
    appVersion.value = pkg.version
  } catch {
    appVersion.value = '1.0.0'
  }
})
</script>

<style scoped>
.settings-view {
  padding: 24px;
  max-width: 800px;
}

/* Page Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-light);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  flex: 1;
  justify-content: center;
}

.page-header-spacer {
  width: 80px;
}

/* Settings Content */
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.section-title svg {
  color: var(--accent);
}

/* Setting Item */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  gap: 16px;
}

.setting-item:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.setting-item.danger .setting-label {
  color: var(--danger);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.setting-control {
  flex-shrink: 0;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: all var(--transition-fast);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

input:checked + .toggle-slider {
  background-color: var(--accent);
  border-color: var(--accent);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Select */
select {
  padding: 8px 32px 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

select:focus {
  border-color: var(--accent);
  outline: none;
}

/* Buttons */
.devtools-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.devtools-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--danger);
  transition: all var(--transition-fast);
}

.reset-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--danger);
}

/* About Section */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
}

.app-logo {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-bottom: 16px;
}

.app-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.app-version {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.app-platform {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
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

.modal-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 360px;
  max-width: 90vw;
}

.modal-box h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.modal-box p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-btns button {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.modal-btns button:hover {
  background: var(--bg-hover);
}

.modal-btns button.danger {
  background: var(--danger);
  color: white;
}

.modal-btns button.danger:hover {
  background: #dc2626;
}

@media (max-width: 768px) {
  .settings-view {
    padding: 16px;
  }
  
  .page-header {
    flex-wrap: wrap;
  }
  
  .page-title {
    order: -1;
    width: 100%;
    justify-content: flex-start;
    margin-bottom: 8px;
  }
  
  .page-header-spacer {
    display: none;
  }
  
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .setting-control {
    width: 100%;
  }
  
  select {
    width: 100%;
  }
}
</style>
