import { State } from '../types'
import { isBoolean, isString, pickBy } from 'lodash-es'
import { envPrefix } from './env-prefix'

export const env = (state: State): Record<string, string | boolean> => {
  return pickBy(
    {
      ...state.viteConfig.env,
      ...state.vite.loadEnv(
        state.nodeEnv,
        state.viteConfig.envDir ?? state.viteConfig.root,
        envPrefix(state)
      )
    },
    (value) => isString(value) || isBoolean(value)
  )
}
