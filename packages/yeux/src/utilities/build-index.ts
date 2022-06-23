import { State } from '../types'
import { build as esbuild } from 'esbuild'
import path from 'path'
import { step } from './log'
import { buildOptions } from './build-options'
import { resolve } from './resolve'
import { chmod } from 'fs/promises'

// await esbuild({
//   stdin: {
//     contents: INDEX_CJS_CONTENTS(state),
//     resolveDir: path.dirname(state.serverOutputDirectory),
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

  const outfile = state.serverIndexPath

  await esbuild({
    ...buildOptions(state),
    stdin: {
      contents,
      resolveDir: path.dirname(state.serverOutputDirectory),
      loader: 'js'
    },
    external: [
      './*',
      `${await resolve('@yeuxjs/runtime', state.basedir)}`,
      `${await resolve('@fastify/static', state.basedir)}`,
      `${await resolve('@fastify/middie', state.basedir)}`,
      `${await resolve('source-map-support', state.basedir)}`
    ],
    outfile
  })

  await chmod(outfile, state.maskFile + 0o110)
}
