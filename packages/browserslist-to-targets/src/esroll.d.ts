declare global {
  const __ENVIRONMENT__: 'production' | 'staging' | 'testing' | undefined
  const __PLATFORM__: 'neutral' | undefined
  const __VERSION__: string | undefined
}

export {}
