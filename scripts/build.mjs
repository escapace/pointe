import { build } from 'esbuild'
import { execa } from 'execa'
import fse from 'fs-extra'
import { mkdir } from 'fs/promises'
import path from 'path'
import { cwd, external, name, target, version } from './constants.mjs'
import process from 'process'

process.umask(0o022)
process.chdir(cwd)

const outdir = path.join(cwd, 'lib/esm')

await fse.remove(outdir)
await mkdir(outdir, { recursive: true })

const tsconfig =
  /* name === 'yeux' ? path.join(cwd, 'tsconfig.json') : */ path.join(
    cwd,
    'tsconfig-build.json'
  )

await build({
  bundle: true,
  entryPoints:
    name === 'yeux' ? ['src/index.ts', 'src/cli.ts'] : ['src/index.ts'],
  external: ['esbuild', ...external],
  splitting: true,
  format: 'esm',
  logLevel: 'info',
  define: {
    VERSION: JSON.stringify(version)
  },
  outExtension: { '.js': '.mjs' },
  outbase: path.join(cwd, 'src'),
  outdir,
  platform: 'node',
  sourcemap: true,
  minifySyntax: true,
  target,
  tsconfig
})

await fse.remove(path.join(cwd, 'lib/types'))

await execa(
  path.join(cwd, 'node_modules', '.bin', 'tsc'),
  ['-p', tsconfig, '--emitDeclarationOnly', '--declarationDir', 'lib/types'],
  { all: true, cwd }
).catch((reason) => {
  console.error(reason.all)
  process.exit(reason.exitCode)
})
