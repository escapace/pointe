import { State } from '../types'
import { build as esbuild, BuildFailure, BuildResult } from 'esbuild'
import { mkdirp } from 'fs-extra'
import path from 'path'
import { step } from './log'
import { buildOptions } from './build-options'

export const buildApi = async (
  state: State,
  onRebuild?: (error: BuildFailure | null, result: BuildResult | null) => void
) => {
  if (state.serverAPIEntryEnable) {
    const outdir = path.dirname(state.serverAPIEntryCompiledPath)

    await mkdirp(outdir)

    step(`API Build`)

    await esbuild({
      ...buildOptions(state),
      entryPoints: [state.serverAPIEntryPath],
      outdir,
      watch:
        state.command === 'dev'
          ? {
              onRebuild
            }
          : undefined
    })
  }
}
