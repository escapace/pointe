#!/usr/bin/env node

import sourceMapSupport from 'source-map-support'
sourceMapSupport.install()

import arg from 'arg'
import colors from 'chalk'
import { includes, pick, flatMap } from 'lodash-es'
import process from 'node:process'
import { ZodError } from 'zod'

declare const VERSION: string

const HELP = () => `pointe/${VERSION}

${colors.bold('Usage:')}
  pointe [options]

${colors.bold('Repository:')}
  https://github.com/escapace/pointe

${colors.bold('Commands:')}
  dev              start dev server (default)
  build            build for production
  preview          locally preview production build

${colors.bold('Options:')}
  --host [host]           [string] specify hostname (default: "127.0.0.1")
  --port <port>           [number] specify port (default: 3000)
  -h, --help              Display this message
  -v, --version           Display version number
`

const help = (message?: string): never => {
  console.log(HELP())

  if (message !== undefined) {
    console.error(message)

    process.exit(1)
  } else {
    process.exit(0)
  }
}

void (async () => {
  const arguments_ = arg({
    // types
    '--help': Boolean,
    '--host': String,
    '--port': Number,
    '--version': Boolean,

    // aliases
    '-h': '--help',
    '-v': '--version',
  })

  if (arguments_['--help'] === true) {
    help()
  }

  if (arguments_['--version'] === true) {
    console.log(VERSION)

    process.exit(0)
  }

  if (arguments_._.length > 1) {
    help()
  }

  const command = (arguments_._[0] ?? 'dev') as 'build' | 'dev' | 'preview'

  if (!includes(['build', 'dev', 'preview'], command)) {
    help(`${command}: unknown command.`)
  }

  const directory = process.cwd()

  const { pointe } = await import('./index')

  try {
    await pointe({
      command,
      directory,
      host: arguments_['--host'],
      port: arguments_['--port'],
    })
  } catch (error) {
    if (error instanceof ZodError) {
      help(
        flatMap(
          pick(error.format(), ['host', 'port']) as Record<string, { _errors: string[] }>,
          (value, key) =>
            flatMap(value._errors, (message) => `${colors.red('Error:')} --${key} ${message}`),
        ).join('\n'),
      )
    } else if (error instanceof Error) {
      console.error(`${colors.red('Error:')} ${error.message}`)
      process.exit(1)
    } else {
      console.error('Unknown Error')
      process.exit(1)
    }
  }
})()
