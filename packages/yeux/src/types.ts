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
  nodeEnv: string
  outputDirectory: string
  packageJson: PackageManifest
  serverAPIEntryCompiledPath: string
  serverAPIEntryEnable: boolean
  serverAPIEntryPath: string
  serverCreateInstanceCompiledPath: string
  serverCreateInstancePath: string
  serverHMRPort: number
  serverHMRPrefix: string
  serverHost: string
  serverOutputDirectory: string
  serverPort: number
  serverSSREntryCompiledPath: string
  serverSSREntryPath: string
  serverIndexPath: string
  serverSSRManifestPath: string
  serverSSRTemplatePath: string
  sourceMapSupportVersion: string
  target: string
  templatePath: string
  tsconfigPath: string
  umask: number
  vite: Vite
  viteConfig: ViteConfig
}
