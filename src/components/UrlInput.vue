<template>
  <div class="url-input">
    <div class="input-wrapper">
      <SvgIcon name="link" :size="18" class="input-icon" />
      <input
        v-model="url"
        type="text"
        placeholder="输入音频 URL（支持 mp3, m4a, ogg, flac, wav...）"
        @keydown.enter="handleAdd"
        class="url-field"
      />
      <button class="add-btn" @click="handleAdd" :disabled="!url.trim()">
        <SvgIcon name="plus" :size="18" />
        <span>添加</span>
      </button>
    </div>
    <div v-if="localError" class="error-msg">
      {{ localError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const player = useAudioPlayer()
const url = ref('')
const localError = ref('')

function handleAdd() {
  const trimmed = url.value.trim()
  if (!trimmed) return
  localError.value = ''

  try {
    new URL(trimmed) // validate URL
    player.playUrl(trimmed)
    url.value = ''
  } catch {
    // Try as plain URL without protocol
    try {
      new URL('https://' + trimmed)
      player.playUrl('https://' + trimmed)
      url.value = ''
    } catch {
      localError.value = '请输入有效的 URL 地址'
    }
  }
}
</script>

<style scoped>
.url-input {
  padding: 16px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 6px 6px 6px 14px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.input-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.url-field {
  flex: 1;
  min-width: 0;
  padding: 8px 4px;
  font-size: 13px;
  color: var(--text-primary);
}

.url-field::placeholder {
  color: var(--text-muted);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.add-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
}

@media (max-width: 768px) {
  .add-btn span {
    display: none;
  }
  .add-btn {
    padding: 8px 10px;
  }
}
</style>
