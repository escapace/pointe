import type { InlineConfig } from './types'

type YeuxInlineConfig = InlineConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Yeux
     */
    yeux?: YeuxInlineConfig
  }
}

export {}

