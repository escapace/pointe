/* eslint-disable @typescript-eslint/no-unsafe-return */
// import { memoize } from 'lodash'
import { resolvePath } from 'mlly'
import { pathToFileURL } from 'url'

// export const resolve = memoize((id: string, state: State) =>
//   sync(id, { extensions: ['.js', '.mjs', '.cjs'], basedir: state.basedir })
// )

export const resolve = async (id: string, basedir: string): Promise<string> =>
  await resolvePath(id, {
    extensions: ['.mjs', '.cjs', '.js', '.json'],
    conditions: ['node', 'import', 'require'],
    url: pathToFileURL(basedir)
  })
