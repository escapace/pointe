import type { CustomAtRules, TransformOptions } from 'lightningcss'
import { transform } from 'lightningcss'
import { createUnplugin } from 'unplugin'

export const lightningcss = createUnplugin(
  (options: Omit<TransformOptions<CustomAtRules>, 'code' | 'filename'>) => {
    return {
      name: 'lightningcss',
      transformInclude(id) {
        return id.endsWith('.css')
      },
      transform(source, id) {
        const { code, map } = transform({
          sourceMap: true,
          ...options,
          filename: id,
          code: Buffer.from(source)
        })

        return {
          code: code.toString(),
          map: map?.toString()
        }
      }
    }
  }
)
