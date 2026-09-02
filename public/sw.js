/*
 * ElectricPro service worker（課題7b・Phase F）
 *
 * 目的: 抱っこ中・移動中など「電波が弱く読み込み待ちが許されない場面こそが隙間時間」
 * （docs/design/study-time-scarcity.md §3 課題7）。起動のたびのネットワーク往復をなくす。
 *
 * 方針: ビルドツール（vite-plugin-pwa / workbox）を足さず、手書きの最小SWで済ませる。
 * ハッシュ付きの成果物（/assets/xxxx-<hash>.js）は内容が変わればURLが変わる＝不変なので、
 * 「precache リストを生成する」必要はなく、初回アクセス時の runtime caching で十分。
 *   - ナビゲーション（HTML）: network-first → 失敗時はキャッシュ済み index.html
 *     （index.html はハッシュが付かないので、オンラインなら必ず最新を見に行く）
 *   - 同一オリジンの静的ファイル: cache-first（URLが不変なので古い内容を掴む心配がない）
 *   - Supabase（別オリジン）の API・認証・画像: **一切介入しない**
 *     （認証トークンや署名URLをキャッシュしないため。問題画像のオフライン化は課題7c で別途）
 *
 * 更新: sw.js のバイト差分でブラウザが新SWを検出する。VERSION を上げると旧キャッシュを捨てる。
 * skipWaiting + clients.claim で即座に置き換え、ページ側（lib/swRegister.ts）が
 * controllerchange を受けて1度だけリロードする。
 */

const VERSION = 'v1'
const SHELL_CACHE = `electricpro-shell-${VERSION}`

// 起動に最低限必要なものだけ。アイコン等は runtime caching に任せる
// （install 時に1つでも取れないと install ごと失敗するため、リストは短く保つ）。
const PRECACHE_URLS = ['/', '/index.html']

// cache-first で扱う同一オリジンのパス。ハッシュ付き成果物と、内容が変わらない静的ファイル。
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)$/.test(url.pathname)
  )
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // 別オリジン（Supabase の REST・Auth・Storage）は素通し。
  // 認証トークン付きのレスポンスや TTL 付きの署名URLをキャッシュに残さない。
  if (url.origin !== self.location.origin) return

  // ① ナビゲーション: network-first。オフラインならキャッシュ済みのアプリシェルを返す。
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(SHELL_CACHE)
          cache.put('/index.html', fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match('/index.html')
          if (cached) return cached
          throw new Error('offline and no cached app shell')
        }
      })(),
    )
    return
  }

  // ② 静的ファイル: cache-first。URLが不変なので、掴んだキャッシュが古くなることはない。
  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const fresh = await fetch(request)
        // 部分応答・エラー応答はキャッシュしない（Cache API が壊れるため）。
        if (fresh.ok && fresh.status === 200) {
          const cache = await caches.open(SHELL_CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      })(),
    )
  }

  // ③ それ以外の同一オリジン GET は既定どおりネットワークへ。
})
