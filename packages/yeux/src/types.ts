import type { PackageManifest } from '@pnpm/types'

import type {
  build,
  createServer,
  InlineConfig as ViteInlineConfig,
  resolveConfig,
  ResolvedConfig as ViteConfig,
  ViteDevServer
} from 'vite'

export type { ViteConfig, ViteDevServer, ViteInlineConfig }

export interface Vite {
  build: typeof build
  createServer: typeof createServer
  resolveConfig: typeof resolveConfig
}

export interface State {
  basedir: string
  browserOutputDirectory: string
  color: boolean
  command: 'build' | 'dev' | 'preview'
  createInstanceCompiledPath: string
  createInstancePath: string
  devIndexPath: string
  devOutputDirectory: string
  directory: string
  hmrPort: number
  hmrPrefix: string
  host: string
  nodeEnv: string
  packageJson: PackageManifest
  port: number
  sourceMapSupportVersion: string
  ssrEntryCompiledPath: string
  ssrEntryPath: string
  ssrIndexPath: string
  ssrManifestPath: string
  ssrOutputDirectory: string
  ssrTemplatePath: string
  target: string
  templatePath: string
  tsconfigPath: string
  vite: Vite
  viteConfig: ViteConfig
}
