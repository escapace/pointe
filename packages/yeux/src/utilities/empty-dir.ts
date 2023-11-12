import fse from 'fs-extra'
import path from 'path'

export const emptyDir = async function emptyDir(
  dir: string,
  exclude = ['.gitignore']
) {
  let items

  try {
    items = await fse.readdir(dir)
  } catch {
    return await fse.mkdirs(dir)
  }

  const aasd = items.filter((value) => !exclude.includes(value))

  console.log(aasd)

  return await Promise.all(
    items
      .filter((value) => !exclude.includes(value))
      .map(async (item) => await fse.remove(path.join(dir, item)))
  )
}
