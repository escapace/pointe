import 'source-map-support/register'
import arg from 'arg'
import { includes } from 'lodash'

// Usage:
//   $ vite [root]
//
// Commands:
//   [root]           start dev server
//   build [root]     build for production
//   optimize [root]  pre-bundle dependencies
//   preview [root]   locally preview production build
//
// For more info, run any command with the `--help` flag:
//   $ vite --help
//   $ vite build --help
//   $ vite optimize --help
//   $ vite preview --help
//
// Options:
//   --host [host]           [string] specify hostname
//   --port <port>           [number] specify port
//   --https                 [boolean] use TLS + HTTP/2
//   --open [path]           [boolean | string] open browser on startup
//   --cors                  [boolean] enable CORS
//   --strictPort            [boolean] exit if specified port is already in use
//   --force                 [boolean] force the optimizer to ignore the cache and re-bundle
//   -c, --config <file>     [string] use specified config file
//   --base <path>           [string] public base path (default: /)
//   -l, --logLevel <level>  [string] info | warn | error | silent
//   --clearScreen           [boolean] allow/disable clear screen when logging
//   -d, --debug [feat]      [string | boolean] show debug logs
//   -f, --filter <filter>   [string] filter debug logs
//   -m, --mode <mode>       [string] set env mode
//   -h, --help              Display this message
//   -v, --version           Display version number

const help = (message?: string): never => {
  console.log('help menu')

  if (message !== undefined) {
    console.error(message)

    process.exit(1)
  } else {
    process.exit(0)
  }
}

void (async () => {
  const args = arg({
    // Types
    '--help': Boolean,
    '--host': String,
    '--port': Number,

    // aliases
    '-h': '--help'
  })

  if (args['--help'] === true) {
    help()
  }

  if (args._.length > 1) {
    help()
  }

  const command = (args._[0] ?? 'dev') as 'build' | 'dev' | 'preview'

  if (!includes(['build', 'dev', 'preview'], command)) {
    help(`${command}: unknown command.`)
  }

  const directory = process.cwd()

  const { yeux } = await import('./index')

  await yeux({
    command,
    directory,
    host: args['--host'],
    port: args['--port']
  })
})()
