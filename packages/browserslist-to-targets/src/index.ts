import browserslist from 'browserslist'
import type { Targets as LightningcssTargetsOption } from 'lightningcss'
import { isEmpty, map, omit } from 'lodash-es'

interface Options extends browserslist.Options {
  queries?: string | readonly string[] | null
}

type BrowserlistTargets =
  | 'and_chr'
  | 'and_ff'
  | 'and_qq'
  | 'and_uc'
  | 'android'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'ie'
  | 'ios_saf'
  | 'kaios'
  | 'op_mini'
  | 'opera'
  | 'safari'
  | 'samsung'

type EsbuildTargets =
  | 'chrome'
  | 'deno'
  | 'edge'
  | 'firefox'
  | 'hermes'
  | 'ie'
  | 'ios'
  | 'node'
  | 'opera'
  | 'rhino'
  | 'safari'

export type LightningcssTargets = keyof LightningcssTargetsOption

// https://github.com/parcel-bundler/lightningcss/blob/master/node/browserslistToTargets.js
// https://github.com/parcel-bundler/lightningcss/blob/master/node/targets.d.ts
const BROWSER_MAPPING_LIGHTNINGCSS: Record<
  BrowserlistTargets,
  LightningcssTargets | undefined
> = {
  and_chr: 'chrome',
  and_ff: 'firefox',
  and_qq: undefined,
  and_uc: undefined,
  android: 'android',
  chrome: 'chrome',
  edge: 'edge',
  ie: 'ie',
  firefox: 'firefox',
  ios_saf: 'ios_saf',
  kaios: undefined,
  op_mini: undefined,
  opera: 'opera',
  safari: 'safari',
  samsung: 'samsung'
}

// https://esbuild.github.io/api/#target
const BROWSER_MAPPING_ESBUILD: Record<
  BrowserlistTargets,
  EsbuildTargets | undefined
> = {
  and_chr: 'chrome',
  and_ff: 'firefox',
  and_qq: undefined,
  and_uc: undefined,
  android: undefined,
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  ie: undefined,
  ios_saf: 'ios',
  kaios: undefined,
  op_mini: undefined,
  opera: 'opera',
  safari: 'safari',
  samsung: undefined
}

function parseVersion(version: string): number | undefined {
  const [major, minor = 0, patch = 0] = version
    .split('-')[0]
    .split('.')
    .map((v) => parseInt(v, 10))

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    return undefined
  }

  return (major << 16) | (minor << 8) | patch
}

function fromBrowserlist<
  T extends typeof BROWSER_MAPPING_ESBUILD | typeof BROWSER_MAPPING_LIGHTNINGCSS
>(browserslist: string[], mapping: T) {
  type MappingValue = Exclude<
    T extends Record<keyof T, infer X> ? X : undefined,
    undefined
  >

  const targets = {} as unknown as Record<MappingValue, number | undefined>

  for (const browser of browserslist) {
    const [name, v] = browser.split(' ') as [keyof T, string]

    const newName = mapping[name] as MappingValue | undefined

    if (newName === undefined) {
      continue
    }

    const version = parseVersion(v)

    if (version === undefined) {
      continue
    }

    const value = targets[newName]

    if (value === undefined || version < value) {
      targets[newName] = version
    }
  }

  return targets
}

export const browserslistToTargets = (
  options: Options
): {
  browserslist: string[]
  lightningcss: Record<LightningcssTargets, number | undefined>
  esbuild: string[]
} => {
  const browserslistOptions = omit(options ?? {}, ['queries'])

  const browsers = browserslist(
    options.queries,
    isEmpty(browserslistOptions) ? undefined : browserslistOptions
  )

  const lightningcssTargets = fromBrowserlist(
    browsers,
    BROWSER_MAPPING_LIGHTNINGCSS
  )

  // A function that receives a single 24-bit number, the number represents a
  // semantic version with one semver component (major, minor, patch) per byte.
  // For example, the number 852480 would represent version 13.2.0. The function
  // returns the major minor and patch components of the semantic version.

  const semver = (version: number): number[] => [
    (version >> 16) & 0xff,
    (version >> 8) & 0xff,
    version & 0xff
  ]

  const esbuildTargets = map(
    fromBrowserlist(browsers, BROWSER_MAPPING_ESBUILD),
    (value, key) => {
      const version = typeof value === 'number' ? semver(value) : undefined
      const browser =
        BROWSER_MAPPING_ESBUILD[key as keyof typeof BROWSER_MAPPING_ESBUILD]

      if (version !== undefined && browser !== undefined) {
        if (version[2] === 0) {
          version.pop()
        }

        if (version[1] === 0) {
          version.pop()
        }

        if (version[0] === 0) {
          version.pop()
        }

        if (version.length !== 0) {
          return `${browser}${version.join('.')}`
        }
      }

      return undefined
    }
  ).filter((value): value is string => value !== undefined)

  return {
    browserslist: browsers,
    lightningcss: lightningcssTargets,
    esbuild: esbuildTargets
  }
}
