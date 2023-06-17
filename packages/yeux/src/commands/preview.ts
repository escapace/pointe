import { watch } from 'chokidar'
import { execa, ExecaChildProcess } from 'execa'
import { isNumber } from 'lodash-es'
import path from 'path'
import { State } from '../types'
import { info, step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build } from './build'

const enum TypeState {
  Blocked,
  NotBusy,
  Busy
}

interface Store {
  state: TypeState
}

// async function delay(interval = 10) {
//   return await new Promise((resolve) =>
//     setTimeout(() => resolve(undefined), interval)
//   )
// }

// eslint-disable-next-line @typescript-eslint/promise-function-async
const kill = (child: ExecaChildProcess, signal: NodeJS.Signals) => {
  return new Promise<{ code: number | null } | { error: unknown }>(
    (resolve) => {
      if (child.killed || isNumber(child.exitCode)) {
        resolve({ code: child.exitCode })
      } else {
        child.kill(signal)

        void child.once('exit', (code) => {
          void child.removeAllListeners()

          resolve({ code })
        })

        void child.once('error', (error) => {
          void child.removeAllListeners()

          resolve({ error })
        })
      }
    }
  )
}

const exitHandler = async (child: ExecaChildProcess<string>) => {
  const signals: Array<[NodeJS.Signals, number]> = [
    ['SIGINT', 1000],
    ['SIGTERM', 1500],
    ['SIGKILL', 3000]
  ]

  return await signals.reduce(
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (acc, [signal, timeout]) =>
      acc.then(
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        () =>
          new Promise((resolve) => {
            let alreadyDone = false

            const done = () => {
              if (!alreadyDone) {
                alreadyDone = true
                resolve()
              }
            }

            if (child.killed || isNumber(child.exitCode)) {
              done()
            } else if (signal === 'SIGKILL') {
              void kill(child, signal).finally(done)
            } else {
              void kill(child, signal).finally(done)
              setTimeout(done, timeout)
            }
          })
      ),
    Promise.resolve()
  )
}

export const preview = async (state: State) => {
  const storeProcess: Store = { state: TypeState.NotBusy }

  await build(state)

  step('Preview')

  let instance: ExecaChildProcess<string> | undefined

  storeProcess.state = TypeState.NotBusy

  const restart = async () => {
    if (storeProcess.state === TypeState.NotBusy) {
      storeProcess.state = TypeState.Busy

      if (instance !== undefined) {
        await exitHandler(instance)
      }

      instance = execa(
        'node',
        [
          path.relative(
            state.serverOutputDirectory,
            state.serverEntryCompiledPath
          )
        ],
        {
          cleanup: true,
          env: {
            HOST: state.serverHost,
            PORT: `${state.serverPort}`,
            NODE_ENV: `${state.nodeEnv}`,
            [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
          },
          cwd: state.serverOutputDirectory
        }
      )

      prefixChildProcess(instance)

      if (storeProcess.state === TypeState.Busy) {
        storeProcess.state = TypeState.NotBusy
      }

      if (instance.pid !== undefined) {
        info(`Process ${instance.pid} running`)
      }
    }
  }

  await restart()

  const watcher = watch(state.watchPaths, {
    // ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    followSymlinks: true,
    cwd: state.directory
  })

  const storeWatcher: Store = { state: TypeState.NotBusy }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  watcher.on('change', async () => {
    if (storeWatcher.state === TypeState.NotBusy) {
      storeWatcher.state = TypeState.Busy

      try {
        await build(state)
        await restart()
      } catch (e) {
        console.log(e)
      }

      if (storeWatcher.state === TypeState.Busy) {
        storeWatcher.state = TypeState.NotBusy
      }
    }
  })
  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach(
    (event) =>
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      process.once(event, async () => {
        storeWatcher.state = TypeState.Blocked
        storeProcess.state = TypeState.Blocked
        await watcher.close()

        if (instance !== undefined) {
          void exitHandler(instance)
        }
      })
  )
}
