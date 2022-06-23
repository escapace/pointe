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
    [path.relative(state.serverOutputDirectory, state.serverIndexPath)],
    {
      env: {
        HOST: state.serverHost,
        PORT: `${state.serverPort}`,
        [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
      },
      cwd: state.serverOutputDirectory
    }
  )

  prefixChildProcess(server)

  process.exit((await server).exitCode)
}
