import { State } from '../types'
import { build } from './build'
import { execa } from 'execa'
import path from 'path'

export const preview = async (state: State) => {
  await build(state)

  const server = await execa(
    'node',
    [path.relative(state.ssrOutputDirectory, state.ssrIndexPath)],
    {
      env: {
        HOST: state.host,
        PORT: `${state.port}`
      },
      stdout: process.stdout,
      stderr: process.stderr,
      cwd: state.ssrOutputDirectory
    }
  )

  process.exit(server.exitCode)
}
