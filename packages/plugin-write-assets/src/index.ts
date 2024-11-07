import fs from 'node:fs/promises'
import path from 'node:path'
import type { ResolvedConfig, Plugin } from 'vite'

interface Options {
  include: (filename: string) => boolean
  outDir?: string
  publicDir?: boolean
}

export const writeAssets = (options: Options): Plugin => {
  let config: ResolvedConfig
  let options_: Required<Options>

  return {
    apply: 'serve',
    async buildStart() {
      // TODO: rimraf outDir
      const outDirectory = path.resolve(config.root, options_.outDir)

      if (options_.publicDir) {
        await fs.cp(path.resolve(config.root, config.publicDir), outDirectory, {
          recursive: true,
        })
      }
    },
    configResolved(value) {
      config = value
      options_ = {
        outDir: config.build.outDir,
        publicDir: true,
        ...options,
      }
    },
    enforce: 'post',
    name: '@pointe/write-assets',
    async transform(_, id) {
      const [filename] = id.split(`?`, 2)

      if (options_.include(filename)) {
        const sourcePath = path.resolve(config.root, filename)

        const stat = await fs.stat(sourcePath)

        if (stat.isFile()) {
          const destinationPath = path.join(
            path.resolve(config.root, options_.outDir),
            path.relative(config.root, sourcePath),
          )

          await fs.mkdir(path.dirname(destinationPath), { recursive: true })
          await fs.cp(sourcePath, destinationPath)
        }
      }
    },
  }
}
