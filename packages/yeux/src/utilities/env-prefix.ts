import { compact, uniq, filter } from 'lodash-es'
import { State } from '../types'

export const envPrefix = (state: State, server: boolean): string[] => {
  const envPrefix =
    state.viteConfig.envPrefix ?? (server ? 'VITE_SERVER_' : 'VITE_CLIENT_')

  return filter(
    uniq(
      compact([
        ...(envPrefix === undefined
          ? []
          : Array.isArray(envPrefix)
          ? envPrefix
          : [envPrefix]),
        server ? 'VITE_SERVER_' : 'VITE_CLIENT_'
      ])
    ),
    (value) => value !== 'VITE_'
  )
}
