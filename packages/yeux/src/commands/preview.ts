import { execa } from 'execa'
import path from 'path'
import { State } from '../types'
import { step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build } from './build'

export const preview = async (state: State) => {
  await build(state)

  step('Preview')

  const server = execa(
    'node',
    [path.relative(state.ssrOutputDirectory, state.ssrIndexPath)],
    {
      env: {
        HOST: state.host,
        PORT: `${state.port}`,
        [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
      },
      // stdout: stdoutPrefix().pipe(process.stdout),
      // stderr: stderrPrefix().pipe(process.stderr),
      cwd: state.ssrOutputDirectory
    }
  )

  prefixChildProcess(server)

  process.exit((await server).exitCode)
}
