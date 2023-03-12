import { execa, ExecaChildProcess } from 'execa'
import { isNumber } from 'lodash-es'
import path from 'path'
import type { RollupWatcher, RollupWatcherEvent } from 'rollup'
import { State } from '../types'
import { info, step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build, patchOptions } from './build'

const enum TypeState {
  None,
  Active,
  Block
}

interface Store {
  state: TypeState
}

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
  const store: Store = { state: TypeState.None }

  const result = await build(state)

  const client = result.client as RollupWatcher
  const server = result.server as RollupWatcher

  step('Preview')

  let instance: ExecaChildProcess<string> | undefined

  store.state = TypeState.Active

  const restart = async () => {
    if (store.state === TypeState.Active) {
      store.state = TypeState.Block

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

      store.state = TypeState.Active

      if (instance.pid !== undefined) {
        info(`Process ${instance.pid} running`)
      }
    }
  }

  await restart()

  const eventListener = async (event: RollupWatcherEvent) => {
    if (event.code === 'END') {
      await patchOptions(state)
      await restart()
    }
  }

  server.on('event', eventListener)
  client.on('event', eventListener)
  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach(
    (event) =>
      process.once(event, () => {
        store.state = TypeState.None

        server.off('event', eventListener)
        client.off('event', eventListener)
        void client.close()
        void server.close()

        if (instance !== undefined) {
          void exitHandler(instance)
        }
      })
  )
}
