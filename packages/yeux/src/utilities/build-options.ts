import { BuildOptions } from 'esbuild'
import { State } from '../types'
import { esbuildExternalPlugin } from '../plugins/external'

export const buildOptions = (state: State): BuildOptions => ({
  bundle: true,
  color: state.color,
  define: {
    'import.meta.env.SSR': 'true',
    'process.env.NODE_ENV': JSON.stringify(state.nodeEnv)
  },
  format: 'esm',
  logLevel: 'info',
  minify: false,
  outExtension: { '.js': `.mjs` },
  platform: 'node',
  plugins: [esbuildExternalPlugin()],
  sourcemap: true,
  target: state.target
})
