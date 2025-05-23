/* eslint-disable unicorn/consistent-function-scoping */
import type { Comment, Root } from 'hast'
import rehypeFormat from 'rehype-format'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { visitParents } from 'unist-util-visit-parents'
import type { Plugin } from 'vite'
import { fromHtml } from 'hast-util-from-html'

const voidElements = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]

export const indexHTML = (options?: { condenseWhitespaceComments?: string[] }) =>
  ({
    enforce: 'post',
    name: '@pointe/plugin-index-html',

    apply: (_, { command, isPreview }) => (command === 'serve' ? isPreview === true : true),

    transformIndexHtml: {
      handler: async (source) => {
        let commentContent = false
        const condenseWhitespaceComments = (
          options?.condenseWhitespaceComments ?? ['<!--app-html-->']
        )
          .flatMap((value) => fromHtml(value, { fragment: true }).children)
          .filter((value): value is Comment => value.type === 'comment')
          .map((value) => value.value.trim())
          .filter((value) => value.length !== 0)

        return String(
          await unified()
            .use(rehypeParse, { fragment: false })
            .use(() => (tree: Root) => {
              visitParents(
                tree,
                (node, parents) => {
                  const parent = parents.at(-1)

                  if (parent === undefined) {
                    return
                  }

                  if (
                    node.type === 'element' &&
                    node.tagName === 'script' &&
                    node.properties.type === 'module'
                  ) {
                    const index = parent.children.indexOf(node)

                    if (index !== -1) {
                      parent.children.splice(index, 1)
                    }
                  } else if (
                    node.type === 'element' &&
                    node.tagName === 'link' &&
                    [node.properties.rel]
                      .flat()
                      .some((value) => value === 'modulepreload' || value === 'stylesheet')
                  ) {
                    const index = parent.children.indexOf(node)

                    if (index !== -1) {
                      parent.children.splice(index, 1)
                    }
                  } else if (node.type === 'comment') {
                    const index = parent.children.indexOf(node)

                    if (node.value.trim() === '' && index !== -1) {
                      parent.children.splice(index, 1)
                    }
                  }
                },
                true,
              )
            })
            .use(rehypeFormat, { blanks: ['head', 'body'], indent: '  ' })
            .use(() => (tree: Root) => {
              visitParents(
                tree,
                (node, parents) => {
                  if (node.type === 'comment') {
                    const parent = parents.at(-1)

                    if (parent === undefined) {
                      return
                    }

                    if (
                      parent.children.some(
                        (node) =>
                          node.type === 'comment' &&
                          condenseWhitespaceComments.includes(node.value.trim()),
                      )
                    ) {
                      return
                    }

                    const index = parent.children.indexOf(node)

                    if (index !== -1) {
                      const level = (parents.length - 1) * 2
                      const lines = node.value.split(/\r?\n/).map((value) => value.trim())

                      parent.children.splice(index, 0, {
                        type: 'text',
                        value: level === 0 ? '\n' : `\n${' '.repeat(level)}`,
                      })

                      node.value = lines
                        .map((value, index) => (index === 0 ? value : ' '.repeat(level) + value))
                        .join('\n')
                    }
                  }
                },
                true,
              )

              visitParents(
                tree,
                (node, parents) => {
                  const parent = parents.at(-1)

                  if (parent === undefined) {
                    return
                  }

                  if (
                    node.type === 'element' &&
                    node.tagName === 'div' &&
                    node.children.length !== 0 &&
                    node.children.every(
                      (value) => value.type === 'comment' || value.type === 'text',
                    ) &&
                    node.children.at(-1)?.type === 'comment' &&
                    !voidElements.includes(node.tagName) &&
                    !node.children.some(
                      (node) =>
                        node.type === 'comment' &&
                        condenseWhitespaceComments.includes(node.value.trim()),
                    )
                  ) {
                    const level = (parents.length - 1) * 2

                    node.children.push({
                      type: 'text',
                      value: level === 0 ? '\n' : `\n${' '.repeat(level)}`,
                    })
                  }
                },
                true,
              )
            })
            .use(rehypeStringify)
            .process(source),
        )
          .split(/\r?\n/)
          .filter((value) => {
            const trimmed = value.trim()

            if (trimmed.includes('<!--') && !commentContent) {
              commentContent = true
            }

            if (trimmed.includes('-->') && commentContent) {
              commentContent = false
            }

            return commentContent ? true : !/^\s*$/.test(value)
          })
          .join('\n')
      },
      order: 'post',
    },
  }) satisfies Plugin
