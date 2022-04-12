import color from 'chalk'
import { EOL } from 'os'

const icon = '↬'
// new Date().toLocaleTimeString()

export const step = (message: string) =>
  console.log(
    `${EOL}${color.dim(icon)} ${color.bold(color.underline(message))}${EOL}`
  )

export const info = (message: string) =>
  console.log(`${color.dim(icon)} ${message}`)

export const warn = (message: string) =>
  console.error(`${color.yellow(icon)} ${message}`)

export const error = (message: string) =>
  console.error(`${color.red(icon)} ${message}`)
