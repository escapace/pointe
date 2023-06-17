import type { PackageManifest } from '@pnpm/types'
import { OptionsProduction } from '@yeuxjs/types'
import type * as ViteDefault from 'vite'
import type {
  ResolvedConfig as ViteConfig,
  ViteDevServer,
  InlineConfig as ViteInlineConfig,
  resolveConfig
} from 'vite'
import type {
  injectManifest as InjectManifest,
  InjectManifestOptions
} from 'workbox-build'

export type { ViteConfig, ViteDevServer, ViteInlineConfig }

export type Vite = typeof ViteDefault

export interface State {
  injectManifest?: typeof InjectManifest
  resolveConfig: (
    inlineConfig?: ViteInlineConfig
  ) => ReturnType<typeof resolveConfig>
  serviceWorkerEntryExists: boolean
  serviceWorkerEntryPath: string
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
  watchPaths: string[]
  serverHMRPrefix: string
  serverHost: string
  serverOutputDirectory: string
  serverPort: number
  serverEntryCompiledPath: string
  serverEntryPath: string
  optionsProduction?: OptionsProduction
  // serverIndexPath: string
  serverSSRManifestName: string
  serverSSRManifestPath: string
  serverManifestName: string
  serverManifestPath: string
  clientManifestName: string
  clientManifestPath: string
  clientTemplatePath: string
  // sourceMapSupportVersion: string
  serverRuntime: 'node' | 'webworker'
  serverTarget: string
  templatePath: string
  tsconfigPath: string
  umask: number
  vite: Vite
  viteConfig: ViteConfig
}

export interface InlineConfig {
  injectManifest: Omit<InjectManifestOptions, 'swSrc' | 'globDirectory' | 'swDest'>
}
