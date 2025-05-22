import fs from 'node:fs/promises'
import path from 'node:path'
import type { ResolvedConfig, Plugin } from 'vite'

interface Options {
  include: (filename: string) => boolean
  outDir?: string
  publicDir?: boolean
}

export const isFile = async (path: string) =>
  await fs
    .stat(path)
    .then((stats) => stats.isFile())
    .catch(() => false)

export const writeAssets = (options: Options): Plugin => {
  let config: ResolvedConfig
  let options_: Required<Options>

  return {
    apply: 'serve',
    async buildStart() {
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
    name: '@pointe/plugin-write-assets',
    async transform(_, id) {
      const url = URL.parse(`file://${id}`)

      if (url === null) {
        return
      }

      const { pathname: filePath } = url

      if (options_.include(filePath)) {
        const sourcePath = path.resolve(config.root, filePath)

        if (await isFile(sourcePath)) {
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
