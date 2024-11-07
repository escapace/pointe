import fse from 'fs-extra'
import path from 'node:path'

export const emptyDirectory = async (directory: string, exclude = ['.gitignore']) => {
  let items

  try {
    items = await fse.readdir(directory)
  } catch {
    return await fse.mkdirs(directory)
  }

  return await Promise.all(
    items
      .filter((value) => !exclude.includes(value))
      .map(async (item) => await fse.remove(path.join(directory, item))),
  )
}
