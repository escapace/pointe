import type { PackageManifest } from '@pnpm/types'
import type { OptionsProduction } from '@pointe/types'
import type * as ViteDefault from 'vite'
import type {
  resolveConfig,
  ResolvedConfig as ViteConfig,
  ViteDevServer,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import type { injectManifest as InjectManifest, InjectManifestOptions } from 'workbox-build'

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
  nodeEnv: 'development' | 'production' | 'staging'
  outputDirectory: string
  packageJson: PackageManifest
  packageJSONPath: string
  resolveConfig: (inlineConfig?: ViteInlineConfig) => ReturnType<typeof resolveConfig>
  serviceWorkerEntryExists: boolean
  serviceWorkerEntryPath: string
  injectManifest?: typeof InjectManifest
  // serverAPIEntryCompiledPath: string
  // serverAPIEntryEnable: boolean
  // serverAPIEntryPath: string
  // serverCreateInstanceCompiledPath: string
  // serverCreateInstancePath: string
  serverEntryCompiledPath: string
  serverEntryPath: string
  serverHMRPrefix: string
  serverHost: string
  serverOutputDirectory: string
  serverPort: number
  watchPaths: string[]
  optionsProduction?: OptionsProduction
  // serverIndexPath: string
  clientManifestName: string
  clientManifestPath: string
  clientTemplatePath: string
  serverManifestName: string
  serverManifestPath: string
  serverSSRManifestName: string
  serverSSRManifestPath: string
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
  injectManifest: Omit<InjectManifestOptions, 'globDirectory' | 'swDest' | 'swSrc'>
}
