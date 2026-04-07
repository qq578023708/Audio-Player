<template>
  <div class="titlebar" v-if="isElectron">
    <div class="titlebar-drag" />
    <div class="titlebar-controls">
      <button class="tb-btn tb-minimize" @click="handleMinimize" title="最小化">
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
      </button>
      <button class="tb-btn tb-maximize" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2.5" y="0" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="0" y="2.5" width="7" height="7" fill="var(--bg-secondary)" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
      <button class="tb-btn tb-close" @click="handleClose" title="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isElectron = !!window.electronAPI?.isElectron
const isMaximized = ref(false)

function handleMinimize() { window.electronAPI?.minimize() }
function handleMaximize() { window.electronAPI?.maximize() }
function handleClose() { window.electronAPI?.close() }

onMounted(async () => {
  if (isElectron) {
    isMaximized.value = await window.electronAPI!.isMaximized()
    window.electronAPI!.onWindowStateChanged((state: boolean) => {
      isMaximized.value = state
    })
  }
})
</script>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: var(--bg-secondary);
  -webkit-app-region: drag;
}

.titlebar-drag {
  flex: 1;
  height: 100%;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.tb-btn {
  width: 46px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tb-close:hover {
  background: #e81123;
  color: #fff;
}

/* Dark theme override for close button */
@media (prefers-color-scheme: dark) {
  .tb-close:hover {
    background: #c42b1c;
  }
}
</style>
