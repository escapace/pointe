import type { ExecaChildProcess } from 'execa'
import { EOL } from 'os'
import colors from 'chalk'
import split from 'split'
import { Transform } from 'stream'
import process from 'process'

export class PrefixStream extends Transform {
  private readonly _prefix: string

  constructor(prefix: string) {
    super()

    this._prefix = prefix
  }

  _transform(chunk: Buffer, _: string, done: Function) {
    done(null, `${this._prefix}${chunk.toString()}${EOL}`)
  }

  // _flush(done: Function) {
  //   console.log('here')
  //   done()
  // }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prefixChildProcess = (value: ExecaChildProcess<any>) => {
  const icon = '░'

  if (value.stdout !== null) {
    value.stdout
      .pipe(split(/\r?\n/, null, { trailing: false, maxLength: 2 }))
      .pipe(new PrefixStream(colors.dim(`${icon} `)))
      .pipe(process.stdout)
  }

  if (value.stderr !== null) {
    value.stderr
      .pipe(split(/\r?\n/, null, { trailing: false, maxLength: 2 }))
      .pipe(new PrefixStream(colors.red(`${icon} `)))
      .pipe(process.stderr)
  }
}
