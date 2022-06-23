import { State } from '../types'
import { isString, pickBy } from 'lodash-es'
import { envPrefix } from './env-prefix'

export const env = (state: State, server: boolean): Record<string, string> => {
  return pickBy(
    {
      ...state.vite.loadEnv(
        state.nodeEnv,
        state.viteConfig.envDir ?? state.viteConfig.root,
        envPrefix(state, server)
      )
    },
    (value) => isString(value)
  )
}
