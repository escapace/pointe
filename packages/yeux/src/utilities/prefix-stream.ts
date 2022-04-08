import picocolors from 'picocolors'
import { Transform } from 'stream'

export class PrefixStream extends Transform {
  private readonly _prefix: string

  constructor(prefix: string) {
    super()

    this._prefix = prefix
  }

  _transform(chunk: Buffer, _: string, done: Function) {
    console.log('Chunk', chunk.toString())

    done(null, `${this._prefix}${chunk.toString()}`)
  }
}

export const stdoutPrefix = () => new PrefixStream(picocolors.blue('. '))

export const stderrPrefix = () => new PrefixStream(picocolors.red('. '))
