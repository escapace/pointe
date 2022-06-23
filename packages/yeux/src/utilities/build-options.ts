import { BuildOptions } from 'esbuild'
import { State } from '../types'
import { esbuildExternalPlugin } from '../plugins/external'
import { mapValues, mapKeys } from 'lodash-es'
import { env } from './env'

export const buildOptions = (state: State): BuildOptions => {
  const define = {
    'import.meta.env.SSR': JSON.stringify(true),
    ...mapValues(
      mapKeys(env(state, true), (_, key) => `import.meta.env.${key}`),
      (value) => JSON.stringify(value)
    )
  }

  return {
    bundle: true,
    color: state.color,
    define,
    format: 'esm',
    logLevel: 'info',
    minify: false,
    outExtension: { '.js': `.mjs` },
    platform: 'node',
    plugins: [esbuildExternalPlugin()],
    sourcemap: true,
    target: state.target
  }
}
