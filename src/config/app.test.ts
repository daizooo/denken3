import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import manifestRaw from '../../public/manifest.webmanifest?raw'
import { APP_NAME } from './app'

// 静的ファイルは APP_NAME を読めないため、変更漏れをここで検出する。
describe('APP_NAME と静的ファイルの一致', () => {
  it('index.html の <title> と apple-mobile-web-app-title', () => {
    expect(indexHtml).toContain(`<title>${APP_NAME}</title>`)
    expect(indexHtml).toContain(`<meta name="apple-mobile-web-app-title" content="${APP_NAME}" />`)
  })

  it('manifest.webmanifest の name と short_name', () => {
    const manifest = JSON.parse(manifestRaw) as { name: string; short_name: string }
    expect(manifest.name).toBe(APP_NAME)
    expect(manifest.short_name).toBe(APP_NAME)
  })
})
