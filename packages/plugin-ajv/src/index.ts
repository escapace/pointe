import Ajv7 from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import Ajv2020 from 'ajv/dist/2020.js'
import { getEsmExportName } from 'ajv/dist/compile/codegen/code.js'
import type AjvCore from 'ajv/dist/core'
import type { AnySchema, Options as IAjvOptions, SchemaObject } from 'ajv/dist/core'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { build } from 'esbuild'
import { assign, isEmpty, isPlainObject, map, mapKeys, mapValues } from 'lodash-es'
import MagicString from 'magic-string'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { createContext, SourceTextModule } from 'node:vm'
import { createUnplugin } from 'unplugin'

const exists = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path)

    return stats.isFile()
  } catch {
    return false
  }
}

interface Schema {
  file: string
  schema: SchemaObject
  schemaExportName: string
}

interface SchemaExtended extends Schema {
  exportName: string
}

export type TypeSchema = 'draft2019' | 'draft2020' | 'draft7'

const AjvClass: { [S in TypeSchema]: typeof AjvCore } = {
  draft2019: Ajv2019,
  draft2020: Ajv2020,
  draft7: Ajv7,
}

export interface AjvOptions extends Omit<IAjvOptions, 'schemas'> {
  schemas?: {
    [Key in string]?: AnySchema
  }
}

export interface Options {
  include: (id: string) => boolean | null | undefined
  type: TypeSchema
  customOptions?: AjvOptions
  exportName?: (value: Schema) => string | undefined
}

export const ajv = createUnplugin((options: Options) => {
  const ajvFactory = (options_?: AjvOptions) =>
    isEmpty(options_) ? new AjvClass[options.type]() : new AjvClass[options.type](options_)

  const configuration: {
    define: Record<string, string>
  } = { define: {} }

  return {
    enforce: 'pre',
    name: 'ajv',
    async transform(code, file) {
      const magic = new MagicString(code)

      if (!(await exists(file))) {
        return undefined
      }

      const { outputFiles } = await build({
        bundle: true,
        define: configuration.define,
        entryPoints: [file],
        format: 'esm',
        minify: false,
        packages: 'external',
        platform: 'node',
        sourcemap: false,
        target: [`node${process.version.slice(1)}`],
        write: false,
      })

      const source = new TextDecoder('utf-8').decode(outputFiles[0].contents)

      const context = createContext({
        console,
        process: { env: {} },
      })

      const module = new SourceTextModule(source, { context })
      // eslint-disable-next-line typescript/no-unsafe-return
      await module.link(async (spec) => await import(spec))
      await module.evaluate()

      if (module.status !== 'evaluated') {
        throw new Error(`Could not evaluate the configuration file.`)
      }

      const validateSchema = (schema: unknown): schema is SchemaObject => {
        const value = ajvFactory(options.customOptions).validateSchema(schema as AnySchema, false)

        if (value === true) {
          return true
        }

        return false
      }

      if (validateSchema === undefined) {
        throw new Error(`Unable to validate json schama.`)
      }

      const validateSchemaId = (id: string | undefined): id is string => {
        if (id === undefined) {
          return false
        }

        try {
          getEsmExportName(id)
          return true
        } catch {
          return false
        }
      }

      const exports = map(
        module.namespace as Record<string, unknown>,
        (schema, schemaExportName) => {
          if (validateSchema(schema)) {
            const result: Schema = {
              file,
              schema,
              schemaExportName,
            }

            const exportName =
              (options.exportName === undefined ? undefined : options.exportName(result)) ??
              schema.id ??
              schema.$id

            if (validateSchemaId(exportName)) {
              return {
                ...result,
                exportName,
              }
            } else {
              this.warn(
                `Export name missing for a schema in ${path.relative(process.cwd(), file)}.`,
              )
            }
          }

          return undefined
        },
      ).filter((value): value is SchemaExtended => value !== undefined)

      const schemas = Object.fromEntries(
        map(exports, (value): [string, SchemaObject] => [
          value.schema.$id ?? value.schema.$id ?? value.exportName,
          value.schema,
        ]),
      )

      const ajv = ajvFactory({
        ...options.customOptions,
        code: {
          ...options.customOptions?.code,
          esm: true,
          optimize: true,
          source: true,
        },
        schemas: assign(
          {},
          isPlainObject(options.customOptions?.schemas) ? options.customOptions?.schemas : {},
          schemas,
        ),
      })

      const moduleCode = standaloneCode(
        ajv,
        Object.fromEntries(
          map(exports, (value): [string, string] => [
            value.exportName,
            value.schema.$id ?? value.schema.$id ?? value.exportName,
          ]),
        ),
      )

      magic.append('\n')
      magic.append(moduleCode)

      return {
        code: magic.toString(),
        map: magic.generateMap(),
      }
    },
    transformInclude: options.include,
    vite: {
      configResolved(value) {
        const define = mapValues({ ...value.define }, (value) => JSON.stringify(value))

        const environment = { ...value.env, SSR: typeof value.build.ssr === 'string' }

        configuration.define = {
          ...define,
          ...mapKeys(
            mapValues(environment, (value) => JSON.stringify(value)),
            (_, value) => `import.meta.env.${value}`,
          ),
          'import.meta.env': JSON.stringify(environment),
        }
      },
    },
  }
})
