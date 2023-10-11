import fs from 'node:fs/promises'
import path from 'node:path'
import { ResolvedConfig, type Plugin } from 'vite'

interface Options {
  include: (filename: string) => boolean
  outDir?: string
  publicDir?: boolean
}

export const writeAssets = (options: Options): Plugin => {
  let config: ResolvedConfig
  let opts: Required<Options>

  return {
    name: '@yeuxjs/write-assets',
    apply: 'serve',
    enforce: 'post',
    configResolved(value) {
      config = value
      opts = {
        outDir: config.build.outDir,
        publicDir: true,
        ...options
      }
    },
    async buildStart() {
      // TODO: rimraf outDir
      const outDir = path.resolve(config.root, opts.outDir)

      if (opts.publicDir) {
        await fs.cp(path.resolve(config.root, config.publicDir), outDir, {
          recursive: true
        })
      }
    },
    async transform(_, id) {
      const [filename] = id.split(`?`, 2)

      if (opts.include(filename)) {
        const sourcePath = path.resolve(config.root, filename)

        const stat = await fs.stat(sourcePath)

        if (stat.isFile()) {
          const destinationPath = path.join(
            path.resolve(config.root, opts.outDir),
            path.relative(config.root, sourcePath)
          )

          await fs.mkdir(path.dirname(destinationPath), { recursive: true })
          await fs.cp(sourcePath, destinationPath)
        }
      }
    }
  }
}
