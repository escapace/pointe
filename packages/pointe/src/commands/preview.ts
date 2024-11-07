import { watch } from 'chokidar'
import { execa, type ResultPromise as ExecaChildProcess } from 'execa'
import { isNumber } from 'lodash-es'
import path from 'node:path'
import type { State } from '../types'
import { info, step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build } from './build'

const enum TypeState {
  Blocked,
  NotBusy,
  Busy,
}

interface Store {
  state: TypeState
}

// async function delay(interval = 10) {
//   return await new Promise((resolve) =>
//     setTimeout(() => resolve(undefined), interval)
//   )
// }

const kill = async (child: ExecaChildProcess, signal: NodeJS.Signals) =>
  await new Promise<{ code: number | null } | { error: unknown }>((resolve) => {
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
  })

const exitHandler = async (child: ExecaChildProcess) => {
  const signals: Array<[NodeJS.Signals, number]> = [
    ['SIGINT', 1000],
    ['SIGTERM', 1500],
    ['SIGKILL', 3000],
  ]

  return await signals.reduce(
    async (accumulator, [signal, timeout]) =>
      await accumulator.then(
        async () =>
          await new Promise((resolve) => {
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
          }),
      ),
    Promise.resolve(),
  )
}

export const preview = async (state: State) => {
  const storeProcess: Store = { state: TypeState.NotBusy }

  await build(state)

  step('Preview')

  let instance: ExecaChildProcess | undefined

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
          '--enable-source-maps',
          path.relative(state.serverOutputDirectory, state.serverEntryCompiledPath),
        ],
        {
          cleanup: true,
          cwd: state.serverOutputDirectory,
          env: {
            HOST: state.serverHost,
            NODE_ENV: `${state.nodeEnv}`,
            PORT: `${state.serverPort}`,
            [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true',
          },
        },
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
    cwd: state.directory,
    followSymlinks: true,
    persistent: true,
  })

  const storeWatcher: Store = { state: TypeState.NotBusy }

  // eslint-disable-next-line typescript/no-misused-promises
  watcher.on('change', async () => {
    if (storeWatcher.state === TypeState.NotBusy) {
      storeWatcher.state = TypeState.Busy

      try {
        await build(state)
        await restart()
      } catch (error) {
        console.log(error)
      }

      if (storeWatcher.state === TypeState.Busy) {
        storeWatcher.state = TypeState.NotBusy
      }
    }
  })
  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach((event) =>
    // eslint-disable-next-line typescript/no-misused-promises
    process.once(event, async () => {
      storeWatcher.state = TypeState.Blocked
      storeProcess.state = TypeState.Blocked
      await watcher.close()

      if (instance !== undefined) {
        void exitHandler(instance)
      }
    }),
  )
}
