import type { Manifest, ModuleGraph } from 'vite'

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface App {
  fetch: Fetch
}

export interface OptionsDevelopment {
  command: 'dev'
  mode: 'development'
  moduleGraph: ModuleGraph
  template: string
}

export interface OptionsProduction {
  command: 'build' | 'preview'
  manifest: {
    client: Manifest
    server: Manifest
    ssr: Record<string, string[] | undefined>
  }
  mode: 'production' | 'staging'
  template: string
}

export type CreateApp = (options: Options) => Promise<App>
export type Options = OptionsDevelopment | OptionsProduction
export type OptionsStaging = OptionsProduction

declare global {
  const POINTE_OPTIONS: Options
}
