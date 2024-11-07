// import { memoize } from 'lodash'
import { resolvePath } from 'mlly'
import { pathToFileURL } from 'node:url'

// export const resolve = memoize((id: string, state: State) =>
//   sync(id, { extensions: ['.js', '.mjs', '.cjs'], basedir: state.basedir })
// )

export const resolve = async (id: string, basedir: string): Promise<string> =>
  await resolvePath(id, {
    conditions: ['node', 'import', 'require'],
    extensions: ['.mjs', '.cjs', '.js', '.json'],
    url: pathToFileURL(basedir),
  })
