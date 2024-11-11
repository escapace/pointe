import { watch } from 'chokidar'
import { type ResultPromise as ExecaChildProcess, execaCommand } from 'execa'
// import { isNumber } from 'lodash-es'
import { isNumber } from 'lodash-es'
import path from 'node:path'
import type { State } from '../types'
import { step } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { build } from './build'

// async function delay(interval = 10) {
//   return await new Promise((resolve) =>
//     setTimeout(() => resolve(undefined), interval)
//   )
// }

//
// const exitHandler = async (child: ExecaChildProcess) => {
//   const signals: Array<[NodeJS.Signals, number]> = [
//     ['SIGINT', 1000],
//     ['SIGTERM', 1500],
//     ['SIGKILL', 3000],
//   ]
//
//   return await signals.reduce(
//     async (accumulator, [signal, timeout]) =>
//       await accumulator.then(
//         async () =>
//           await new Promise((resolve) => {
//             let alreadyDone = false
//
//             const done = () => {
//               if (!alreadyDone) {
//                 alreadyDone = true
//                 resolve()
//               }
//             }
//
//             if (child.killed || isNumber(child.exitCode)) {
//               done()
//             } else if (signal === 'SIGKILL') {
//               void kill(child, signal).finally(done)
//             } else {
//               void kill(child, signal).finally(done)
//               setTimeout(done, timeout)
//             }
//           }),
//       ),
//     Promise.resolve(),
//   )
// }

const enum TypeState {
  Blocked,
  NotBusy,
  Busy,
}

type StoreProcess =
  | {
      type: TypeState.Blocked | TypeState.Busy
      controller?: AbortController
      instance?: ExecaChildProcess
    }
  | {
      type: TypeState.NotBusy
    }

interface StoreWatcher {
  type: TypeState
}

const kill = async (child: ExecaChildProcess, controller: AbortController) =>
  await new Promise<{ code: number | null } | { error: unknown }>((resolve) => {
    if (child.killed || isNumber(child.exitCode) || controller.signal.aborted) {
      resolve({ code: child.exitCode })
    } else {
      controller.abort()

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

export const preview = async (state: State) => {
  // eslint-disable-next-line typescript/consistent-type-assertions
  const storeProcess: StoreProcess = { type: TypeState.NotBusy } as StoreProcess

  await build(state)

  step('Preview')

  const restart = async () => {
    if (storeProcess.type === TypeState.NotBusy) {
      const controller = new AbortController()
      const cancelSignal = controller.signal

      const instance = execaCommand(
        `node --enable-source-maps ${path.relative(state.serverOutputDirectory, state.serverEntryCompiledPath)}`,
        {
          cancelSignal,
          cleanup: true,
          cwd: state.serverOutputDirectory,
          env: {
            HOST: state.serverHost,
            NODE_ENV: state.nodeEnv,
            PORT: state.serverPort.toString(),
            [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true',
          },
          forceKillAfterDelay: 5000,
          killSignal: 'SIGTERM',
          reject: false,
        },
      )

      Object.assign(storeProcess, {
        controller,
        instance,
        type: TypeState.Busy,
      })

      prefixChildProcess(instance)

      // if (storeProcess.state === TypeState.Busy) {
      //   storeProcess.state = TypeState.NotBusy
      // }
      //
      // if (instance.pid !== undefined) {
      //   info(`Process ${instance.pid} running`)
      // }
    } else if (storeProcess.instance !== undefined && storeProcess.controller !== undefined) {
      const type = storeProcess.type === TypeState.Busy ? TypeState.NotBusy : TypeState.Blocked
      const { controller, instance } = storeProcess

      Object.assign(storeProcess, {
        controller: undefined,
        instance: undefined,
        type: TypeState.Blocked,
      })

      await kill(instance, controller)

      if (type === TypeState.NotBusy) {
        Object.assign(storeProcess, {
          type,
        })

        await restart()
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

  const storeWatcher: StoreWatcher = { type: TypeState.NotBusy }

  // eslint-disable-next-line typescript/no-misused-promises
  watcher.on('change', async () => {
    if (storeWatcher.type === TypeState.NotBusy) {
      storeWatcher.type = TypeState.Busy

      try {
        await build(state)
        await restart()
      } catch (error) {
        console.log(error)
      }

      if (storeWatcher.type === TypeState.Busy) {
        storeWatcher.type = TypeState.NotBusy
      }
    }
  })
  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach((event) =>
    // eslint-disable-next-line typescript/no-misused-promises
    process.once(event, async () => {
      storeWatcher.type = TypeState.Blocked
      storeProcess.type = TypeState.Blocked
      await watcher.close()

      void restart()
    }),
  )
}
