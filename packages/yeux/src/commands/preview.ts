import { execa } from 'execa'
import path from 'path'
import type { RollupWatcher } from 'rollup'
import { State } from '../types'
import { step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build } from './build'

export const preview = async (state: State) => {
  const result = await build(state)

  const client = result.client as RollupWatcher
  const server = result.server as RollupWatcher

  console.log({ client, server })

  step('Preview')

  const instance = execa(
    'node',
    [path.relative(state.serverOutputDirectory, state.serverEntryCompiledPath)],
    {
      env: {
        NODE_ENV: `${state.nodeEnv}`,
        [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
      },
      cwd: state.serverOutputDirectory
    }
  )

  prefixChildProcess(instance)

  process.exit((await instance).exitCode)
}

// await fse.emptyDir(state.clientOutputDirectory)
// await fse.emptyDir(state.serverOutputDirectory)
//
// // await buildIndex(await INDEX_CONTENTS(state), state)
//
// let server: ExecaChildProcess<string> | undefined
//
// const { serverEntryCompiledPath } = state
// // const relativeDevIndexPath = path.relative(state.directory, devIndexPath)
//
// const exitHandler = (signal: NodeJS.Signals = 'SIGTERM') => {
//   if (server !== undefined) {
//     if (server.kill(signal)) {
//       server = undefined
//     } else {
//       warn(`Unable to ${signal} process with pid '${server.pid as number}'.`)
//
//       setTimeout(() => exitHandler('SIGKILL'), 1500)
//
//       // eslint-disable-next-line no-unmodified-loop-condition, no-empty
//       while (server !== undefined) {}
//     }
//   }
// }
//
// ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach(
//   (event) =>
//     process.once(event, () => {
//       exitHandler()
//
//       process.exit()
//     })
// )
//
// const restart = throttle(
//   () => {
//     if (server !== undefined) {
//       info(`restarting dev server`)
//
//       exitHandler()
//     } else {
//       info(`starting dev server`)
//     }
//
//     server = execa('node', [serverEntryCompiledPath], {
//       detached: true,
//       buffer: false,
//       env: {
//         // HOST: state.serverHost,
//         // PORT: `${state.serverPort}`,
//         NODE_ENV: `${state.nodeEnv}`,
//         [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
//       },
//       // stdout: process.stdout,
//       // stderr: process.stderr,
//       cwd: state.directory
//     })
//
//     prefixChildProcess(server)
//   },
//   1000,
//   { leading: true }
// )
//
// // await buildEntries(state, restart)
//
// restart()
