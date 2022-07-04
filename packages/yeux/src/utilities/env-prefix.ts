import { compact, uniq } from 'lodash-es'
import { State } from '../types'

export const envPrefix = (state: State): string[] => {
  const envPrefix = state.viteConfig.envPrefix ?? 'VITE_'

  return uniq(
    compact([
      ...(envPrefix === undefined
        ? []
        : Array.isArray(envPrefix)
        ? envPrefix
        : [envPrefix])
    ])
  )
}
