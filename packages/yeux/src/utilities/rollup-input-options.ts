import path from 'path'
import type { InputOption } from 'rollup'

export const rollupInputOptions = (
  input: InputOption | undefined,
  state: { directory: string }
) =>
  (input === undefined
    ? { main: path.join(state.directory, 'index.html') }
    : typeof input === 'string'
    ? { main: input }
    : input) as {
    [entryAlias: string]: string
  }
