import path from 'node:path'
import type { ViteInlineConfig } from '../types'

type InputOption = Exclude<
  Exclude<Exclude<ViteInlineConfig['build'], undefined>['rollupOptions'], undefined>['input'],
  undefined
>

export const rollupInputOptions = (input: InputOption | undefined, state: { directory: string }) =>
  (input === undefined
    ? { main: path.join(state.directory, 'index.html') }
    : typeof input === 'string'
      ? { main: input }
      : input) as Record<string, string>
