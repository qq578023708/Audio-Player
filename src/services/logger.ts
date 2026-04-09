/**
 * In-app logger service
 * Captures console logs for display in mobile app (where chrome://inspect is unavailable)
 */

export interface LogEntry {
  timestamp: number
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  args: any[]
}

const MAX_LOGS = 500
const logs: LogEntry[] = []
let originalConsole: typeof console | null = null
let isInitialized = false

export function initLogger(): void {
  if (isInitialized) return
  if (typeof window === 'undefined') return

  // Store original console methods
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  } as typeof console

  // Override console methods
  console.log = (...args: any[]) => {
    addLog('log', args)
    originalConsole!.log(...args)
  }
  console.warn = (...args: any[]) => {
    addLog('warn', args)
    originalConsole!.warn(...args)
  }
  console.error = (...args: any[]) => {
    addLog('error', args)
    originalConsole!.error(...args)
  }
  console.info = (...args: any[]) => {
    addLog('info', args)
    originalConsole!.info(...args)
  }

  // Capture unhandled errors
  window.addEventListener('error', (e) => {
    addLog('error', [`[Uncaught Error] ${e.message} at ${e.filename}:${e.lineno}`])
  })
  window.addEventListener('unhandledrejection', (e) => {
    addLog('error', [`[Unhandled Promise Rejection] ${e.reason}`])
  })

  isInitialized = true
  console.log('[Logger] Initialized')
}

function addLog(level: LogEntry['level'], args: any[]): void {
  const message = args
    .map((a) => {
      if (typeof a === 'string') return a
      if (a instanceof Error) return a.stack || a.message
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')

  logs.push({
    timestamp: Date.now(),
    level,
    message: message.slice(0, 1000), // Limit message length
    args,
  })

  // Trim old logs
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS)
  }
}

export function getLogs(): LogEntry[] {
  return [...logs]
}

export function clearLogs(): void {
  logs.length = 0
}

export function exportLogs(): string {
  return logs
    .map((l) => {
      const time = new Date(l.timestamp).toLocaleTimeString()
      return `[${time}] [${l.level.toUpperCase()}] ${l.message}`
    })
    .join('\n')
}
