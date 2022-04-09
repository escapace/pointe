import picocolors from 'picocolors'
import type { Colors } from 'picocolors/types'
import supportsColor from 'supports-color'

export const color: Colors = picocolors.createColors(
  !(supportsColor.stdout === false)
)
