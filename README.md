# AudioFlow Player

[![Release](https://github.com/<YOUR_USERNAME>/audioflow-player/actions/workflows/release.yml/badge.svg)](https://github.com/<YOUR_USERNAME>/audioflow-player/actions/workflows/release.yml)
[![CI Build](https://github.com/<YOUR_USERNAME>/audioflow-player/actions/workflows/build.yml/badge.svg)](https://github.com/<YOUR_USERNAME>/audioflow-player/actions/workflows/build.yml)

跨平台网络音频播放器 — 支持 Windows / Linux / macOS / Android

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript + Pinia |
| 构建工具 | Vite 6 |
| 音频引擎 | Howler.js（支持网络流媒体） |
| 桌面端 | Electron（Win/Linux/Mac） |
| 移动端 | Capacitor（Android） |

## 功能特性

- 🌐 **网络流媒体播放** — 输入 URL 即可播放 mp3/m4a/ogg/flac/wav 等格式
- 📋 **播放列表管理** — 添加/删除/清空，本地持久化存储
- 🔀 **多种播放模式** — 顺序播放、列表循环、随机播放、单曲循环
- 🔊 **音量控制** — 滑块调节、静音切换、媒体键快捷键
- ⌨️ **键盘快捷键** — 空格暂停、方向键快进快退
- 🎨 **深色/浅色主题** — 跟随系统自动切换
- 📱 **响应式布局** — 适配桌面和移动端

## 快速开始

### 1. 安装依赖

```bash
cd audio-player
npm install
```

### 2. 开发模式（Web）

```bash
npm run dev
```

浏览器打开 http://localhost:5173

### 3. Electron 桌面端开发

```bash
npm run electron:dev
```

### 4. 构建桌面应用

```bash
# 全平台
npm run electron:build

# 仅 Windows
npm run electron:build:win

# 仅 macOS
npm run electron:build:mac

# 仅 Linux
npm run electron:build:linux
```

构建产物在 `release/` 目录下。

### 5. 构建 Android 应用

```bash
# 添加 Android 平台（首次）
npm run cap:add:android

# 构建 Web 资源并同步
npm run build
npm run cap:sync

# 构建 Debug APK
cd android && ./gradlew assembleDebug

# 构建 Release APK（需要签名配置）
cd android && ./gradlew assembleRelease
```

APK 产物在 `android/app/build/outputs/apk/` 目录下。

### 6. 用 Android Studio 开发

```bash
# 添加 Android 平台
npm run cap:add:android

# 构建并同步
npm run build
npm run cap:sync

# 打开 Android Studio
npm run cap:open:android
```

> **注意**: Android 开发需要安装 Android Studio 和 Android SDK。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Space` | 播放 / 暂停 |
| `←` | 后退 5 秒 |
| `→` | 前进 5 秒 |
| `↑` | 音量增加 5% |
| `↓` | 音量减少 5% |
| `N` | 下一曲 |
| `P` | 上一曲 |
| `M` | 静音切换 |

## CI/CD 自动构建

项目配置了 GitHub Actions 自动构建：

- **CI Build** (`.github/workflows/build.yml`): Push/PR 时触发类型检查和构建
- **Release** (`.github/workflows/release.yml`): Push tag `v*.*.*` 时触发多平台发布

支持平台：
| 平台 | 产物 |
|------|------|
| Windows | `.exe` (NSIS 安装包) |
| macOS | `.dmg` (Universal) |
| Linux | `.AppImage`, `.deb` |
| Android | `.apk` |

## 项目结构

```
audio-player/
├── electron/               # Electron 主进程
│   ├── main.cjs            # 主进程入口
│   └── preload.cjs         # 预加载脚本
├── src/
│   ├── components/         # Vue 组件
│   │   ├── SvgIcon.vue     # SVG 图标组件
│   │   ├── NowPlaying.vue  # 当前播放信息
│   │   ├── ProgressBar.vue # 进度条
│   │   ├── PlayerControls.vue # 播放控制按钮
│   │   ├── VolumeControl.vue   # 音量控制
│   │   ├── UrlInput.vue    # URL 输入框
│   │   ├── TrackItem.vue   # 单曲列表项
│   │   ├── PlaylistPanel.vue # 播放列表面板
│   │   └── DemoTracks.vue  # 示例曲目
│   ├── composables/
│   │   └── useAudioPlayer.ts  # 音频播放引擎（核心）
│   ├── stores/
│   │   └── playlist.ts     # Pinia 状态管理
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   ├── App.vue             # 根组件
│   ├── main.ts             # 应用入口
│   ├── style.css           # 全局样式
│   └── env.d.ts            # 类型声明
├── public/                 # 静态资源
├── capacitor.config.json   # Capacitor 配置
├── index.html              # HTML 入口
├── package.json            # 依赖与脚本
├── tsconfig.json           # TypeScript 配置
└── vite.config.ts          # Vite 配置
```

## License

MIT
