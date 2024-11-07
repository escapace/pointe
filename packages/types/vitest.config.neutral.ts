import { defineConfig, mergeConfig } from 'vitest/config'
import { version } from './package.json'
import { builds } from './scripts/constants.json'
import configShared from './vitest.config'

export default mergeConfig(
  configShared,
  defineConfig({
    define: {
      ...builds.neutral.define,
      __VERSION__: JSON.stringify(version),
    },
    esbuild: {
      platform: 'neutral',
      target: builds.neutral.target,
    },
    test: {
      environment: 'node',
      include: ['{src,tests}/**/+([a-zA-Z0-9-]).{test,spec}.?(c|m)[jt]s?(x)'],
      name: 'neutral',
      sequence: {
        hooks: 'list',
      },
    },
  }),
)
