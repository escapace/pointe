import fse from 'fs-extra'
import path from 'path'
import process from 'process'
import semver from 'semver'

import { fileURLToPath } from 'url'

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../'
)

export const cwd = process.cwd()
export const packageJSON = await fse.readJSON(path.join(cwd, 'package.json'))
export const rootPackageJSON = await fse.readJSON(
  path.join(root, 'package.json')
)
export const name = packageJSON.name
export const external = [
  'esbuild',
  ...Object.keys(packageJSON.dependencies ?? {}),
  ...Object.keys(packageJSON.peerDependencies ?? {})
]
export const target = [
  `node${semver.minVersion(rootPackageJSON.engines.node).version}`
]
export const version = packageJSON.version
