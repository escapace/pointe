import { build } from 'esbuild'
import { execa } from 'execa'
import fse from 'fs-extra'
import { mkdir } from 'fs/promises'
import path from 'path'
import { cwd, target, external, name } from './constants.mjs'

const options = {
  cjs: {
    outdir: path.join(cwd, 'lib/cjs'),
    tsconfig: name === 'yeux' ? undefined : path.join(cwd, 'tsconfig.json'),
    entryPoints:
      name === 'yeux'
        ? ['lib/tsc/index.js', 'lib/tsc/cli.js']
        : ['src/index.ts']
  }
}

process.umask(0o022)
process.chdir(cwd)

await fse.remove(path.join(cwd, 'lib'))

await execa(path.join(cwd, 'node_modules', '.bin', 'tsc'), ['-b'], {
  all: true,
  cwd
}).catch((reason) => {
  console.error(reason.all)
  process.exit(reason.exitCode)
})

await Promise.all(
  Object.keys(options).map(async (format) => {
    const { outdir } = options[format]

    await fse.remove(outdir)
    await mkdir(outdir, { recursive: true })

    await build({
      bundle: true,
      external,
      format,
      logLevel: 'info',
      outExtension: { '.js': `.${format === 'esm' ? 'mjs' : 'cjs'}` },
      platform: 'node',
      sourcemap: true,
      ...options[format]
    })
  })
)