import path from 'node:path'

export const extensionImage = [
  '3dv',
  'PI1',
  'apng',
  'PI2',
  'PI3',
  'ai',
  'amf',
  'art',
  'art',
  'ase',
  'avif',
  'avifs',
  'awg',
  'blp',
  'bmp',
  'bw',
  'bw',
  'cd5',
  'cdr',
  'cgm',
  'cit',
  'cmx',
  'cpt',
  'cr2',
  'cur',
  'cut',
  'dds',
  'dib',
  'djvu',
  'dxf',
  'e2d',
  'ecw',
  'egt',
  'egt',
  'emf',
  'eps',
  'exif',
  'fs',
  'gbr',
  'gif',
  'gif',
  'gpl',
  'grf',
  'hdp',
  'heic',
  'heif',
  'icns',
  'ico',
  'iff',
  'iff',
  'int',
  'int',
  'inta',
  'jfif',
  'jng',
  'jp2',
  'jpeg',
  'jpg',
  'jps',
  'jxr',
  'lbm',
  'lbm',
  'liff',
  'max',
  'miff',
  'mng',
  'msp',
  'nef',
  'nitf',
  'nrrd',
  'odg',
  'ota',
  'pam',
  'pbm',
  'pc1',
  'pc2',
  'pc3',
  'pcf',
  'pct',
  'pcx',
  'pcx',
  'pdd',
  'pdn',
  'pgf',
  'pgm',
  'pict',
  'png',
  'pnm',
  'pns',
  'ppm',
  'psb',
  'psd',
  'psp',
  'px',
  'pxm',
  'pxr',
  'qfx',
  'ras',
  'raw',
  'rgb',
  'rgb',
  'rgba',
  'rle',
  'sct',
  'sgi',
  'sgi',
  'sid',
  'stl',
  'sun',
  'svg',
  'sxd',
  'tga',
  'tga',
  'tif',
  'tiff',
  'v2d',
  'vnd',
  'vrml',
  'vtf',
  'wdp',
  'webp',
  'wmf',
  'x3d',
  'xar',
  'xbm',
  'xcf',
  'xpm'
]

export const extensionFont = ['eot', 'otf', 'ttc', 'ttf', 'woff', 'woff2']

export const extensionJavaScript = [
  '.mjs',
  '.js',
  '.mts',
  '.ts',
  '.jsx',
  '.tsx',
  '.json'
]

export const extensionCSS = [
  'css',
  'less',
  'sass',
  'scss',
  'styl',
  'stylus',
  'pcss',
  'postcss'
]

export const extensionMedia = [
  'mp4',
  'webm',
  'ogg',
  'mp3',
  'wav',
  'flac',
  'aac',
  'opus'
]

const assetFileNameReturn = (assetsDir: string, type?: string) => {
  if (type === undefined) {
    return path.join(assetsDir, '[name]-[hash].[ext]')
  } else {
    return path.join(assetsDir, type, '[name]-[hash].[ext]')
  }
}

export const hasExtension = (filename: string, extensions: string[]) =>
  extensions.some((extension) =>
    filename.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
  )

export const createAssetFileNames =
  (assetsDir: string) => (filename?: string) => {
    if (filename === undefined) {
      return assetFileNameReturn(assetsDir)
    }

    if (hasExtension(filename, extensionImage)) {
      return assetFileNameReturn(assetsDir, 'images')
    }

    if (hasExtension(filename, extensionFont)) {
      return assetFileNameReturn(assetsDir, 'fonts')
    }

    if (hasExtension(filename, extensionJavaScript)) {
      return assetFileNameReturn(assetsDir, 'scripts')
    }

    if (hasExtension(filename, extensionCSS)) {
      return assetFileNameReturn(assetsDir, 'styles')
    }

    if (hasExtension(filename, extensionMedia)) {
      return assetFileNameReturn(assetsDir, 'media')
    }

    return assetFileNameReturn(assetsDir, 'application')
  }
