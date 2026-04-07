/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'howler' {
  interface HowlOptions {
    src?: string | string[]
    html5?: boolean
    format?: string[]
    volume?: number
    preload?: boolean
    autoplay?: boolean
    loop?: boolean
    xhr?: Record<string, unknown>
    onload?: () => void
    onloaderror?: (id: number, error: unknown) => void
    onplayerror?: (id: number, error: unknown) => void
    onplay?: () => void
    onpause?: () => void
    onstop?: () => void
    onend?: () => void
    onseek?: () => void
    onfade?: () => void
  }

  class Howl {
    constructor(options?: HowlOptions)
    play(spriteOrId?: string | number): number
    pause(id?: number): Howl
    stop(id?: number): Howl
    seek(seek?: number, id?: number): number
    volume(vol?: number, id?: number): number
    duration(id?: number): number
    unload(): Howl
    load(): Howl
    fade(from: number, to: number, duration: number, id?: number): Howl
    playing(id?: number): boolean
    state(): string
  }

  class Howler {
    static volume(vol?: number): number
    static mute(muted?: boolean): boolean
    static unload(): void
    static codecs(ext?: string): boolean
  }

  export { Howl, Howler, HowlOptions }
}
