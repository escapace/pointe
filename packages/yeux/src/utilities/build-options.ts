import { BuildOptions } from 'esbuild'
import { State } from '../types'
import { esbuildExternalPlugin } from '../plugins/external'
import { mapValues, mapKeys } from 'lodash-es'
import { env } from './env'

export const buildOptions = (state: State): BuildOptions => {
  const define = {
    ...mapValues(
      mapKeys(env(state), (_, key) => `import.meta.env.${key}`),
      (value) => JSON.stringify(value)
    ),
    'import.meta.env.SSR': JSON.stringify(true)
  }

  return {
    bundle: true,
    color: state.color,
    define,
    treeShaking: true,
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
