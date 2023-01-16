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
  manifest?: Record<string, string[] | undefined>
}

export type CreateApp = (options: AppOptions) => Promise<App>
