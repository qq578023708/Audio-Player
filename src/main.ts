import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { setupElectronFetchProxy } from './composables/useElectron'

// Patch fetch for Electron production (proxy /api/ requests through main process)
setupElectronFetchProxy()

// Set CSS variable for titlebar height in Electron
if (window.electronAPI?.isElectron) {
  document.documentElement.style.setProperty('--titlebar-height', '32px')
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
