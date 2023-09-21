import { assert } from 'chai'
import { build } from 'esbuild'
import { Targets, transform } from 'lightningcss'
import { forEach } from 'lodash-es'
import { browserslistToTargets } from '.'

export const minify = (value: string, targets: Targets) => {
  const { code } = transform({
    targets,
    filename: 'style.css',
    code: Buffer.from(value),
    minify: true
  })

  return code.toString()
}

describe('./src/index.spec.ts', () => {
  it('type checks', () => {
    const { browserslist, lightningcss, esbuild } = browserslistToTargets({
      queries: '> 0.00001%'
    })

    assert.isArray(esbuild)
    assert.isArray(browserslist)
    assert.isObject(lightningcss)

    forEach(esbuild, (value) => assert.isString(value))
    forEach(lightningcss, (value) => assert.isNumber(value))
    forEach(browserslist, (value) => assert.isString(value))
  })

  it('lightningcss', () => {
    const targets = browserslistToTargets({
      queries: '>= 0.25%'
    })

    const string = minify(
      `
.logo {
  background: image-set(url(logo.png) 2x, url(logo.png) 1x);
}
`,
      targets.lightningcss
    )

    assert.isString(string)
  })

  it('esbuild', async () => {
    const targets = browserslistToTargets({
      queries: '>= 0.25%'
    })

    const result = await build({
      stdin: {
        contents: `
export function parseVersion(version: string): number | undefined {
  const [major, minor = 0, patch = 0] = version
    .split('-')[0]
    .split('.')
    .map((v) => parseInt(v, 10))

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    return undefined
  }

  return (major << 16) | (minor << 8) | patch
}
`,
        resolveDir: './src',
        sourcefile: 'imaginary-file.ts',
        loader: 'ts'
      },
      target: targets.esbuild,
      format: 'esm',
      write: false
    })

    assert.isString(result.outputFiles[0].text)
  })
})
