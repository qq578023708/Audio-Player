<template>
  <div class="source-view">
    <div class="page-header">
      <h1 class="page-title">
        <SvgIcon name="link" :size="22" />
        音源管理
      </h1>
      <p class="page-desc">导入落雪音乐 (LX Music) 自定义音源插件，即可在线解析播放歌曲</p>
    </div>

    <!-- Import LX Music source -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">
          <SvgIcon name="plus" :size="16" />
          导入音源插件
        </h2>
      </div>

      <div class="import-card">
        <div class="import-method">
          <button class="method-btn" :class="{ active: importMethod === 'paste' }" @click="importMethod = 'paste'">
            粘贴代码
          </button>
          <button class="method-btn" :class="{ active: importMethod === 'file' }" @click="importMethod = 'file'">
            选择文件
          </button>
        </div>

        <div v-if="importMethod === 'paste'">
          <textarea
            v-model="sourceCode"
            placeholder="将落雪音乐音源插件的 JS 代码粘贴到这里...&#10;&#10;提示：脚本头部应有 @name 注释，代码中应包含 globalThis.lx 的使用"
            rows="8"
            class="source-textarea"
          />
          <button class="import-btn" @click="importFromCode" :disabled="!sourceCode.trim() || isImporting">
            <SvgIcon v-if="!isImporting" name="plus" :size="14" />
            <SvgIcon v-else name="loader" :size="14" class="spinning" />
            {{ isImporting ? '正在导入...' : '导入音源' }}
          </button>
        </div>

        <div v-else class="file-upload">
          <input
            ref="fileInput"
            type="file"
            accept=".js,.txt"
            style="display:none"
            @change="onFileSelect"
          />
          <button class="upload-area" @click="fileInput?.click()">
            <SvgIcon name="folder" :size="24" />
            <span>点击选择 .js 音源文件</span>
            <span class="upload-hint">或从 D:\Downloads\lxmusic-source-main\ 选择</span>
          </button>
        </div>
      </div>

      <div v-if="importMsg" class="import-msg" :class="importMsg.type">
        {{ importMsg.text }}
      </div>
    </section>

    <!-- Imported plugins list -->
    <section class="section" v-if="sourceStore.plugins.length > 0">
      <div class="section-header">
        <h2 class="section-title">
          <SvgIcon name="disc" :size="16" />
          已导入插件 ({{ sourceStore.plugins.length }})
        </h2>
        <span class="section-hint">
          已启用 {{ sourceStore.enabledPlugins.length }} 个
        </span>
      </div>
      <div class="plugin-list">
        <div
          v-for="plugin in sourceStore.plugins"
          :key="plugin.name"
          class="plugin-item"
          :class="{ 'plugin-enabled': plugin.enabled }"
        >
          <div class="plugin-main">
            <div class="plugin-header">
              <div class="plugin-name-row">
                <div class="plugin-status-dot" :class="plugin.enabled ? 'active' : 'inactive'" />
                <span class="plugin-name">{{ plugin.name }}</span>
                <span class="plugin-version">v{{ plugin.version }}</span>
              </div>
              <div class="plugin-actions">
                <label class="toggle-switch" :title="plugin.enabled ? '禁用插件' : '启用插件'">
                  <input
                    type="checkbox"
                    :checked="plugin.enabled"
                    @change="togglePlugin(plugin.name, !plugin.enabled)"
                  />
                  <span class="toggle-slider" />
                </label>
                <button class="icon-btn danger" @click="removePlugin(plugin.name)" title="移除插件">
                  <SvgIcon name="trash" :size="14" />
                </button>
              </div>
            </div>

            <div class="plugin-details">
              <div class="plugin-meta">
                <span class="meta-tag" :class="plugin.type">
                  {{ plugin.type === 'proxy' ? '代理模式' : '直连模式' }}
                </span>
                <span v-if="plugin.apiUrl" class="meta-tag api">
                  API: {{ truncateUrl(plugin.apiUrl) }}
                </span>
                <span class="meta-tag" :class="plugin.initialized ? 'ok' : 'warn'">
                  {{ plugin.initialized ? '已初始化' : '未初始化' }}
                </span>
              </div>

              <!-- Capabilities from init -->
              <div class="plugin-caps" v-if="Object.keys(plugin.sourceCapabilities || {}).length > 0">
                <div
                  v-for="(cap, src) in plugin.sourceCapabilities"
                  :key="src"
                  class="cap-row"
                >
                  <span class="cap-source" :style="{ color: SOURCE_COLORS[src] || '#aaa' }">
                    {{ SOURCE_NAMES[src] || src }}
                  </span>
                  <span class="cap-actions">
                    {{ (cap as any).actions?.join(', ') || 'musicUrl' }}
                  </span>
                  <span class="cap-qualitys">
                    {{ ((cap as any).qualitys || ['128k', '320k']).join(' / ') }}
                  </span>
                </div>
              </div>

              <!-- Fallback: show parsed sources -->
              <div class="plugin-sources" v-else>
                <span
                  v-for="src in plugin.sources"
                  :key="src"
                  class="source-tag"
                  :style="{ borderColor: SOURCE_COLORS[src] || '#666' }"
                >
                  {{ SOURCE_NAMES[src] || src.toUpperCase() }}
                </span>
                <span
                  v-for="q in plugin.qualitys"
                  :key="q"
                  class="quality-tag"
                >
                  {{ q }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Empty state -->
    <section v-else class="empty-state">
      <SvgIcon name="disc" :size="48" />
      <h3>尚未导入任何音源插件</h3>
      <p>导入落雪音乐的自定义音源脚本后，即可搜索和播放各平台歌曲</p>
    </section>

    <!-- Settings -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">
          <SvgIcon name="settings" :size="16" />
          播放设置
        </h2>
      </div>

      <!-- Quality setting -->
      <div class="settings-group">
        <div class="setting-label">音质选择</div>
        <div class="quality-options">
          <button
            v-for="q in sourceStore.availableQualities"
            :key="q"
            class="quality-btn"
            :class="{ active: sourceStore.preferredQuality === q }"
            @click="sourceStore.setQuality(q)"
          >
            {{ qualityLabels[q] || q }}
          </button>
        </div>
      </div>

      <!-- Auto switch -->
      <div class="settings-group">
        <div class="setting-row">
          <div class="setting-label">播放失败自动切换音源</div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="sourceStore.isAutoSwitch" />
            <span class="toggle-slider" />
          </label>
        </div>
        <p class="setting-desc">当当前音源无法播放时，自动尝试下一个可用音源</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { useSourceStore } from '@/stores/source'
import { parseLxSourcePlugin, SOURCE_NAMES, SOURCE_COLORS } from '@/services/sourceParser'

const sourceStore = useSourceStore()
const importMethod = ref<'paste' | 'file'>('paste')
const sourceCode = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)

const qualityLabels: Record<string, string> = {
  '128k': '标准 128K',
  '320k': '高品质 320K',
  'flac': '无损 FLAC',
  'flac24bit': 'Hi-Res 24bit'
}

const importMsg = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Initialize all enabled plugins on mount
onMounted(async () => {
  await sourceStore.initEnabledPlugins()
})

async function importFromCode() {
  const code = sourceCode.value.trim()
  if (!code || isImporting.value) return

  isImporting.value = true
  importMsg.value = null

  try {
    const plugin = parseLxSourcePlugin(code, 'pasted-source.js')
    if (plugin) {
      await sourceStore.addPlugin(plugin)

      // Try to initialize the plugin
      try {
        const success = await sourceStore.enablePlugin(plugin.name, true)
        if (success) {
          const caps = plugin.sourceCapabilities
          const capSources = caps ? Object.keys(caps).map(s => SOURCE_NAMES[s] || s.toUpperCase()).join(', ') : plugin.sources.map(s => SOURCE_NAMES[s] || s.toUpperCase()).join(', ')
          importMsg.value = { type: 'success', text: `成功导入并初始化: ${plugin.name} (支持 ${capSources})` }
        } else {
          importMsg.value = { type: 'error', text: `导入成功但初始化失败: ${plugin.name}。脚本可能不兼容当前环境（如依赖 Node.js API），但已保存，可稍后手动启用` }
        }
      } catch (initErr: any) {
        importMsg.value = { type: 'success', text: `已导入: ${plugin.name} (初始化警告: ${initErr.message})` }
      }

      sourceCode.value = ''
    } else {
      importMsg.value = { type: 'error', text: '无法解析音源代码，请确认格式正确（需包含 @name 注释和 globalThis.lx 使用）' }
    }
  } catch (e: any) {
    importMsg.value = { type: 'error', text: `导入失败: ${e.message}` }
  }

  isImporting.value = false
  setTimeout(() => { importMsg.value = null }, 8000)
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const code = e.target?.result as string
    sourceCode.value = code
    importMethod.value = 'paste'
    setTimeout(() => importFromCode(), 100)
  }
  reader.readAsText(file)
  input.value = ''
}

async function togglePlugin(name: string, enabled: boolean) {
  try {
    await sourceStore.enablePlugin(name, enabled)
  } catch (e: any) {
    importMsg.value = { type: 'error', text: `操作失败: ${e.message}` }
    setTimeout(() => { importMsg.value = null }, 5000)
  }
}

function removePlugin(name: string) {
  if (confirm(`确定移除音源插件 "${name}"?`)) {
    sourceStore.removePlugin(name)
  }
}

function truncateUrl(url: string): string {
  if (!url) return ''
  if (url.length > 40) return url.substring(0, 40) + '...'
  return url
}
</script>

<style scoped>
.source-view {
  padding: 24px;
  max-width: 800px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
}

.page-desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.section-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* Import */
.import-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.import-method {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.method-btn {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.method-btn:hover {
  background: var(--bg-hover);
}

.method-btn.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.source-textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 100px;
  margin-bottom: 12px;
}

.source-textarea:focus {
  border-color: var(--accent);
  outline: none;
}

.source-textarea::placeholder {
  color: var(--text-muted);
}

.import-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.import-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-area {
  width: 100%;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 2px dashed var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.upload-area:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.import-msg {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.import-msg.success {
  background: rgba(48, 209, 88, 0.1);
  color: var(--success);
}

.import-msg.error {
  background: rgba(255, 69, 58, 0.1);
  color: var(--danger);
}

/* Plugin list */
.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.plugin-item.plugin-enabled {
  border-color: rgba(255, 106, 0, 0.3);
}

.plugin-main {
  flex: 1;
  min-width: 0;
}

.plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plugin-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.plugin-status-dot.active {
  background: var(--success);
  box-shadow: 0 0 6px rgba(48, 209, 88, 0.4);
}

.plugin-status-dot.inactive {
  background: var(--text-muted);
}

.plugin-name {
  font-size: 14px;
  font-weight: 600;
}

.plugin-version {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 8px;
}

.plugin-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-details {
  margin-top: 10px;
}

.plugin-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.meta-tag {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.meta-tag.proxy {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.meta-tag.direct {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
}

.meta-tag.api {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-tag.ok {
  background: rgba(48, 209, 88, 0.1);
  color: var(--success);
}

.meta-tag.warn {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.plugin-caps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-xs);
}

.cap-source {
  font-weight: 600;
  min-width: 60px;
}

.cap-actions {
  color: var(--text-muted);
}

.cap-qualitys {
  color: var(--text-muted);
  margin-left: auto;
}

.plugin-sources {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.source-tag {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  border: 1px solid;
  color: var(--text-secondary);
}

.quality-tag {
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-tertiary);
  border-radius: 10px;
  transition: all var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  top: 2px;
  left: 2px;
  transition: all var(--transition-fast);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: #fff;
}

/* Settings */
.settings-group {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.quality-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.quality-btn {
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.quality-btn:hover {
  border-color: var(--border);
}

.quality-btn.active {
  background: var(--accent);
  color: #fff;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-state p {
  font-size: 13px;
  max-width: 400px;
  line-height: 1.6;
}

/* Icon button */
.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn.danger:hover {
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
</style>
