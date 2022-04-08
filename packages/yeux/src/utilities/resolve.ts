import { sync } from 'resolve'
import { State } from '../types'
import { memoize } from 'lodash'

export const resolve = memoize((id: string, state: State) =>
  sync(id, { extensions: ['.js', '.cjs'], basedir: state.basedir })
)
