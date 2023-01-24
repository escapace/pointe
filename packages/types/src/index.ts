import type { Manifest, ModuleGraph } from 'vite'

export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
) => Promise<Response>

export interface App {
  fetch: Fetch
}

export interface OptionsDevelopment {
  mode: 'development'
  template: string
  moduleGraph: ModuleGraph
}

export interface OptionsProduction {
  mode: 'staging' | 'production'
  template: string
  manifest: {
    client: Manifest
    server: Manifest
    ssr: Record<string, string[] | undefined>
  }
}

export type OptionsStaging = OptionsProduction
export type Options = OptionsDevelopment | OptionsProduction | OptionsStaging
export type CreateApp = (options: Options) => Promise<App>
