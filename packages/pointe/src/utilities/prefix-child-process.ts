import colors from 'chalk'
import type { ResultPromise, Options } from 'execa'
import { EOL } from 'node:os'
import process from 'node:process'
import { Transform } from 'node:stream'
import split from 'split2'

class PrefixStream extends Transform {
  private readonly _prefix: string

  constructor(prefix: string) {
    super()

    this._prefix = prefix
  }

  // eslint-disable-next-line typescript/no-unsafe-function-type
  _transform(chunk: Buffer, _: string, done: Function) {
    // eslint-disable-next-line typescript/no-unsafe-call
    done(null, `${this._prefix}${chunk.toString()}${EOL}`)
  }

  // _flush(done: Function) {
  //   console.log('here')
  //   done()
  // }
}

export const prefixChildProcess = <OptionsType extends Options = Options>(
  value: ResultPromise<OptionsType>,
) => {
  const icon = '░'

  if (value.stdout != null) {
    value.stdout
      .pipe(split(/\r?\n/))
      .pipe(new PrefixStream(colors.dim(`${icon} `)))
      .pipe(process.stdout)
  }

  if (value.stderr !== null) {
    value.stderr
      .pipe(split(/\r?\n/))
      .pipe(new PrefixStream(colors.red(`${icon} `)))
      .pipe(process.stderr)
  }
}
