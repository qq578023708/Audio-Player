# 待完成任务清单

## 已完成 ✅
1. 配置正式签名密钥 workflow
2. 去掉清理 android 目录，恢复 Capacitor 自动处理

## 待完成

### 3. 修复排行榜加载问题（Android）
**问题**: 排行榜使用 `/api/kw-board/*` 代理，这是 Vite dev server 插件，在 APK 中不可用
**方案**: 
- 方案A: 使用 Capacitor HTTP 插件直接请求
- 方案B: 将代理逻辑移到后端 API
- 方案C: 使用 LX Music 插件直接获取排行榜

### 4. 添加设置页面
- 路由: `/settings`
- 功能:
  - 最小化到托盘开关 (Electron)
  - 开发者工具按钮 (Electron)
  - 主题切换
  - 清除缓存

### 5. Electron 关闭最小化改为可选项
- 在设置中存储配置
- 主进程读取配置决定行为

### 6. 添加开发者工具按钮
- 在设置页面添加按钮
- 打开独立开发者工具窗口

### 7. 修复页面返回状态丢失
- 使用 Pinia 存储页面状态
- 或使用 Vue keep-alive
- 或存储滚动位置和列表数据

## 签名配置说明

需要在 GitHub Secrets 中配置:
- `ANDROID_KEYSTORE_BASE64`: base64 编码的 keystore 文件
- `ANDROID_KEY_ALIAS`: 密钥别名
- `ANDROID_KEYSTORE_PASSWORD`: keystore 密码
- `ANDROID_KEY_PASSWORD`: 密钥密码

生成命令:
```bash
keytool -genkey -v -keystore audioflow.keystore -alias audioflow -keyalg RSA -keysize 2048 -validity 10000
base64 audioflow.keystore > keystore.base64.txt
```
