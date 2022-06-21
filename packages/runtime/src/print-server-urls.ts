import colors from 'chalk'
import { networkInterfaces } from 'os'
import { includes, isString, flatMap, map, uniqBy, forEach } from 'lodash-es'

interface AddressInfo {
  address: string
  family: 'IPv4' | 'IPv6' | 4 | 6
  port: number
}

const toString = (address: AddressInfo) =>
  `${colors.cyan(
    new URL(
      `http://${
        address.family === 4 || address.family === 'IPv4'
          ? address.address
          : `[${address.address}]`
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

export const parseAddresses = (addresses: AddressInfo[]) =>
  uniqBy(
    flatMap(addresses, (address) => {
      if (includes(['0.0.0.0', '::'], address.address)) {
        return map(filterNetworkInterfaces(address), (value) => ({
          address: value.address,
          family: value.family,
          port: address.port
        }))
      } else {
        return [address]
      }
    }),
    (value) => toString(value)
  )

export const printServerUrls = (
  addresses: AddressInfo[],
  log = console.log
) => {
  console.log(`Listening on:\n`)

  forEach(parseAddresses(addresses), (address) => log(toString(address)))
}
