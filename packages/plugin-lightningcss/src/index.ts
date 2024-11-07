import type { CustomAtRules, TransformOptions } from 'lightningcss'
import { transform } from 'lightningcss'
import { createUnplugin } from 'unplugin'

export const lightningcss = createUnplugin(
  (options: Omit<TransformOptions<CustomAtRules>, 'code' | 'filename'>) => ({
    name: 'lightningcss',
    transform(source, id) {
      const { code, map } = transform({
        sourceMap: true,
        ...options,
        code: Buffer.from(source),
        filename: id,
      })

      return {
        code: code.toString(),
        map: map?.toString(),
      }
    },
    transformInclude(id) {
      return id.endsWith('.css')
    },
  }),
)
