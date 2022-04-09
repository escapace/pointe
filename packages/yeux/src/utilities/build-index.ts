import { State } from '../types'
import { esbuildExternalPlugin } from '../plugins/external'
import { build as esbuild } from 'esbuild'
import path from 'path'
import { resolve } from './resolve'
import { step } from './log'

// await esbuild({
//   stdin: {
//     contents: INDEX_CJS_CONTENTS(state),
//     resolveDir: path.dirname(state.ssrOutputDirectory),
//     loader: 'js'
//   },
//   bundle: true,
//   format: 'cjs',
//   logLevel: 'error',
//   outfile: state.ssrIndexPath,
//   platform: 'node',
//   plugins: [esbuildExternalPlugin()],
//   external: ['./*', `${resolve('fastify-static', state)}`],
//   sourcemap: true,
//   minify: false,
//   target: state.target
// })

export const buildIndex = async (contents: string, state: State) => {
  step(`Index Build`)

  await esbuild({
    stdin: {
      contents,
      resolveDir: path.dirname(
        state.command === 'dev'
          ? state.devOutputDirectory
          : state.ssrOutputDirectory
      ),
      loader: 'js'
    },
    bundle: true,
    format: 'cjs',
    color: state.color,
    logLevel: 'info',
    outfile: state.command === 'dev' ? state.devIndexPath : state.ssrIndexPath,
    platform: 'node',
    plugins: [esbuildExternalPlugin()],
    external: [
      './*',
      `${resolve('fastify-static', state)}`,
      `${resolve('middie', state)}`,
      `${resolve('source-map-support', state)}`
    ],
    define: {
      'import.meta.env.SSR': 'true',
      'process.env.NODE_ENV': JSON.stringify(state.nodeEnv)
    },
    sourcemap: true,
    minify: false,
    target: state.target
  })
}
