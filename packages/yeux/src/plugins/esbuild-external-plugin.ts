import type { OnResolveArgs, Plugin } from 'esbuild'

// Must not start with "/" or "./" or "../"
const NON_NODE_MODULE_RE = /^[^./]|^\.[^./]|^\.\.[^/]/

interface Options {
  exclude?: Array<string | RegExp>
  include?: Array<string | RegExp>
  skipNodeModulesBundle?: boolean
}

export const exbuildExternalPlugin = (options: Options = {}): Plugin => {
  const { exclude, skipNodeModulesBundle, include } = {
    skipNodeModulesBundle: true,
    exclude: [],
    include: [],
    ...options
  }

  const skip = (args: OnResolveArgs) => {
    if (include.length !== 0) {
      return include.some((p) => {
        if (p instanceof RegExp) {
          return p.test(args.path)
        }

        return args.path === p
      })
    }

    return false
  }

  return {
    name: `external`,

    setup(build) {
      if (skipNodeModulesBundle) {
        build.onResolve({ filter: NON_NODE_MODULE_RE }, (args) => {
          if (skip(args)) {
            return
          }

          return {
            path: args.path,
            external: true
          }
        })
      }

      if (exclude.length === 0) return

      build.onResolve({ filter: /.*/ }, (args) => {
        if (skip(args)) {
          return
        }

        const external = exclude.some((p) => {
          if (p instanceof RegExp) {
            return p.test(args.path)
          }

          return args.path === p
        })

        return { path: args.path, external }
      })
    }
  }
}
