import { describe, expect, it } from 'vitest'
import { indexHTML } from '.'

const content = `
<!DOCTYPE html>
<html>
  <head>
    <!--

        .                                 .o8       oooo
      .o8                                "888        888
    .o888oo oooo  oooo  ooo. .oo.  .oo.   888oooo.   888  oooo d8b
      888    888   888   888P"Y88bP"Y88b  d88'  88b  888   888""8P
      888    888   888   888   888   888  888   888  888   888
      888 .  888   888   888   888   888  888   888  888   888    .o.
      "888"   V88V"V8P' o888o o888o o888o  Y8bod8P' o888o d888b   Y8P

    -->
    <meta charset="utf-8" />
    <meta name="referrer" content="no-referrer-when-downgrade" />
    <link rel="preconnect" href="/" crossorigin />
    <!--resource-hints-->
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="max-snippet:-1, max-image-preview: large, max-video-preview: -1" />
    <link type="text/plain" href="/humans.txt" rel="author" />
    <!--head-tags-->
    <script type="module" crossorigin src="/assets/js/main-BpwR5JBb.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/js/service-worker-3PDbR8De.js">
    <link rel="stylesheet" crossorigin href="/assets/styles/main-C6nfZxQk.css">
    <!-- -->
  </head>

  <body>
    <!--body-tags-open-->
    <div id="app">
      <!--app-html-->
    </div>
    <div class="ipsum">
      <!--comment-->
    </div>
    <div>
    <!--
        .                                 .o8       oooo
      .o8                                "888        888
    .o888oo oooo  oooo  ooo. .oo.  .oo.   888oooo.   888  oooo d8b
      888    888   888   888P"Y88bP"Y88b  d88'  88b  888   888""8P
      888    888   888   888   888   888  888   888  888   888
      888 .  888   888   888   888   888  888   888  888   888    .o.
      "888"   V88V"V8P' o888o o888o o888o  Y8bod8P' o888o d888b   Y8P

    -->
    </div>
    <div class="ipsum">
      <!--comment-->
    <!--
        .                                 .o8       oooo
      .o8                                "888        888
    .o888oo oooo  oooo  ooo. .oo.  .oo.   888oooo.   888  oooo d8b
      888    888   888   888P"Y88bP"Y88b  d88'  88b  888   888""8P
      888    888   888   888   888   888  888   888  888   888

      888 .  888   888   888   888   888  888   888  888   888    .o.
      "888"   V88V"V8P' o888o o888o o888o  Y8bod8P' o888o d888b   Y8P

    -->
    </div>
    <!--initial-state-->
    <!--body-tags-->
  </body>
</html>
`

describe('index-html', () => {
  it('', async () => {
    const handler = indexHTML().transformIndexHtml.handler

    expect(await handler(content)).toMatchSnapshot()
  })
})
