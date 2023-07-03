import fs from 'node:fs/promises'
import path from 'node:path'
import { ResolvedConfig, type Plugin } from 'vite'

interface Options {
  publicDir?: boolean
  include?: (filename: string) => boolean
  outDir?: string
}

export const KNOWN_ASSET_TYPES = [
  // images
  'apng',
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',
  'bmp',
  'tiff',

  // media
  'mp4',
  'webm',
  'ogg',
  'mp3',
  'wav',
  'flac',
  'aac',
  'opus',
  'heic',

  // fonts
  'woff2',
  'woff',
  'eot',
  'ttf',
  'otf'

  // // other
  // 'webmanifest',
  // 'pdf',
  // 'txt',
]

export const writeAssets = (options?: Options): Plugin => {
  let config: ResolvedConfig
  let opts: Required<Options>

  return {
    name: '@yeuxjs/write-assets',
    apply: 'serve',
    enforce: 'post',
    configResolved(value) {
      config = value
      opts = {
        publicDir: true,
        outDir: config.build.outDir,
        include: (filename) =>
          KNOWN_ASSET_TYPES.some((type) => filename.endsWith(type)),
        ...options
      }
    },
    async buildStart() {
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
