import colors from 'picocolors'
import { networkInterfaces } from 'os'
import { includes, isString } from 'lodash-es'
import { AddressInfo } from 'net'

const toString = (address: AddressInfo) =>
  `${colors.cyan(
    new URL(
      `http://${
        address.family === 'IPv4' ? address.address : `[${address.address}]`
      }:${address.port}/`
    ).toString()
  )}`

const filterNetworkInterfaces = (address: AddressInfo) =>
  Object.values(networkInterfaces())
    .flatMap((nInterface) => nInterface ?? [])
    .filter(
      (value) =>
        isString(value?.address) &&
        value.family === address.family &&
        !value.address.startsWith('fe80')
    )

export const printServerUrls = (address: AddressInfo, log = console.log) => {
  console.log(`Listening on:\n`)

  if (includes(['127.0.0.1', '::1'], address.address)) {
    log(`  Local: ${toString(address)}`)
    log(`  Network: ${colors.dim('use `--host` to expose')}`)
  } else if (includes(['0.0.0.0', '::'], address.address)) {
    filterNetworkInterfaces(address)
      .map((value) => {
        const type =
          value.address.includes('127.0.0.1') || value.address.includes('::1')
            ? '  Local:   '
            : '  Network: '

        return `${type} ${toString({
          ...address,
          family: value.family,
          address: value.address
        })}`
      })
      .forEach((msg) => log(msg))
  } else {
    log(`  Network: ${toString(address)}`)
  }
}
