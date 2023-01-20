import type { PackageManifest } from '@pnpm/types'

import * as ViteDefault from 'vite'

import type {
  InlineConfig as ViteInlineConfig,
  ResolvedConfig as ViteConfig,
  ViteDevServer
} from 'vite'

export type { ViteConfig, ViteDevServer, ViteInlineConfig }

export type Vite = typeof ViteDefault

export interface State {
  basedir: string
  clientOutputDirectory: string
  color: boolean
  command: 'build' | 'dev' | 'preview'
  directory: string
  maskDirectory: number
  maskFile: number
  nodeEnv: 'production' | 'staging' | 'development'
  outputDirectory: string
  packageJson: PackageManifest
  packageJSONPath: string
  // serverAPIEntryCompiledPath: string
  // serverAPIEntryEnable: boolean
  // serverAPIEntryPath: string
  // serverCreateInstanceCompiledPath: string
  // serverCreateInstancePath: string
  serverHMRPort: number
  serverHMRPrefix: string
  serverHost: string
  serverOutputDirectory: string
  serverPort: number
  serverEntryCompiledPath: string
  serverEntryPath: string
  // serverIndexPath: string
  serverSSRManifestName: string
  serverSSRManifestPath: string
  serverTemplatePath: string
  // sourceMapSupportVersion: string
  target: string
  templatePath: string
  tsconfigPath: string
  umask: number
  vite: Vite
  viteConfig: ViteConfig
}
