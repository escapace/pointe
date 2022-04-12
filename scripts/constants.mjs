import fse from 'fs-extra'
import path from 'path'
import process from 'process'

export const cwd = process.cwd()
export const name = path.basename(cwd)
export const packageJSON = await fse.readJSON(path.join(cwd, 'package.json'))
export const external = Object.keys(packageJSON.dependencies ?? {})
export const target = ['node16']
export const version = packageJSON.version
