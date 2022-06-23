import { State } from '../types'
import { build as esbuild, BuildFailure, BuildResult } from 'esbuild'
import { mkdirp } from 'fs-extra'
import path from 'path'
import { step } from './log'
import { buildOptions } from './build-options'

export const buildCreateInstance = async (
  state: State,
  onRebuild?: (error: BuildFailure | null, result: BuildResult | null) => void
) => {
  const outdir = path.dirname(state.serverCreateInstanceCompiledPath)

  await mkdirp(outdir)

  step(`Instance Build`)

  await esbuild({
    ...buildOptions(state),
    entryPoints: [state.serverCreateInstancePath],
    outdir,
    watch:
      state.command === 'dev'
        ? {
            onRebuild
          }
        : undefined
  })
}
