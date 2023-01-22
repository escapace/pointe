import type { ModuleGraph } from 'vite'

export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
) => Promise<Response>

export interface App {
  fetch: Fetch
}

export interface AppOptions {
  mode: string
  template: string
  ssrManifest?: Record<string, string[] | undefined>
  moduleGraph?: ModuleGraph
}

export type CreateApp = (options: AppOptions) => Promise<App>
