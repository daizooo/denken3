// 問題画像のオフライン先読み（課題7c・Phase F・§9.4）
//
// 問題画像は Supabase の非公開バケットにあり、表示のたびに TTL 3600秒の署名URLを発行して
// 取りに行く。署名URLは発行のたびに別の文字列になるため、**そのままではキャッシュの鍵に
// できない**（次のセッションでは鍵が変わり、必ずミスする）。
//
// そこで `storage_path` から合成した同一オリジンのURL
//   /__problem-image/{encodeURIComponent(storage_path)}
// を Cache Storage の鍵にし、実体（Blob）だけをそこへ置く。鍵は storage_path だけで決まる＝
// TTL を跨いでも不変なので、翌日でも・オフラインでもヒットする。
// service worker（public/sw.js）がこの接頭辞を **cache-only** で返すため、
// <img src="/__problem-image/..."> はネットワークに出ずに描画される
// （このパスはサーバ上に実在しないので、SW が居ない環境では使わない・resolveImageSrc 参照）。
//
// 先読みの実体取得は `storage.download()`（Supabase SDK）で行う。署名URLの発行・TTL を
// 意識せずに済み、鍵（storage_path）と実体の関係が一本になる。
// 一方、未キャッシュの画像をその場で開いたときは表示用に発行した署名URLをそのまま使い回す
// （二重ダウンロードにしないため・storeImage の srcUrl）。
//
// DBの座標（answer_x_pct 等）も一緒に持たないと、画像があってもマスク位置が決まらず
// オフラインで描画できない。同じ Cache Storage に JSON として置く
// （/__problem-assets/{question_id}・SW は介在せず、このモジュールが直接読み書きする）。
import { supabase } from './supabase'
import { BUCKET, fetchAssets, hasKnownAsset, normalizeAsset, signedUrl, type QuestionAsset } from './assets'

// public/sw.js の IMAGE_CACHE と同じ名前（import できないので両方にこのコメントを置く）。
// シェル（electricpro-shell-<VERSION>）とは別に持ち、シェルの版を上げても画像を捨てない。
const IMAGE_CACHE = 'electricpro-problem-images-v1'
const IMAGE_PREFIX = '/__problem-image/'
const ASSET_PREFIX = '/__problem-assets/'
const CACHED_AT_HEADER = 'x-cached-at'

// 先読みの上限。見開き画像は1枚 0.5〜2MB あり、モバイルのストレージ割当は無限ではない。
// 「今日の分」だけを持てば足りるので、古いものから捨てる（下の evictIfNeeded）。
// 割当を超える put は失敗して黙って捨てられるだけなので、上限は控えめに取る。
const MAX_BYTES = 40 * 1024 * 1024
// 1回の先読みで見に行く問題数の上限。今日のキューが極端に長い日に全部を取りに行かない。
const MAX_QUESTIONS = 40
// 同時ダウンロード数。隙間時間の操作（画像の表示・記録の送信）と帯域を奪い合わせない。
const CONCURRENCY = 2

/** この問題の先読みはこのセッションで既に試したか（記録のたびに再走査しないため） */
const attempted = new Set<string>()

export function problemImageUrl(path: string): string {
  return IMAGE_PREFIX + encodeURIComponent(path)
}

function assetsUrl(questionId: string): string {
  return ASSET_PREFIX + encodeURIComponent(questionId)
}

function cacheAvailable(): boolean {
  return typeof caches !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext
}

/** 合成URLを解決できるのは SW が制御しているときだけ（開発・未対応環境では実在しないパス） */
function swControlled(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller
}

async function openCache(): Promise<Cache | null> {
  if (!cacheAvailable()) return null
  try {
    return await caches.open(IMAGE_CACHE)
  } catch {
    return null // ストレージが使えない環境（プライベートモード等）では先読みだけを諦める
  }
}

/**
 * 画像1枚を取得して Cache Storage に置く。既にあれば何もしない。
 * `srcUrl`（発行済みの署名URL）があればそれを使う ―― 表示に使ったURLと同じなので、
 * ブラウザのHTTPキャッシュが効き、二重ダウンロードになりにくい。
 * 無ければ SDK の download()（先読み時）。署名URLの発行・TTL を意識せずに済む。
 */
async function storeImage(path: string, srcUrl?: string): Promise<boolean> {
  const cache = await openCache()
  if (!cache) return false
  const key = problemImageUrl(path)
  if (await cache.match(key)) return true
  let data: Blob
  if (srcUrl) {
    try {
      const res = await fetch(srcUrl)
      if (!res.ok) return false
      data = await res.blob()
    } catch {
      return false
    }
  } else {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(path)
    if (error || !blob) return false
    data = blob
  }
  const body = new Response(data, {
    headers: {
      'content-type': data.type || 'image/png',
      'content-length': String(data.size),
      [CACHED_AT_HEADER]: new Date().toISOString(),
    },
  })
  try {
    await cache.put(key, body)
    return true
  } catch {
    return false // 容量超過など。次回の先読みで evict 後に再試行される
  }
}

/**
 * 容量の上限を超えていたら、古いものから捨てる。
 * `protectedKeys`（今回の先読み対象）は残す ―― 直後に使う画像を捨てないため。
 * 判断材料は Cache Storage 自身に持たせた content-length / x-cached-at で、
 * 別に索引を持たない（索引と実体がずれる余地を作らない）。
 */
async function evictIfNeeded(protectedKeys: Set<string>): Promise<void> {
  const cache = await openCache()
  if (!cache) return
  const entries: { key: string; bytes: number; at: string }[] = []
  let total = 0
  for (const req of await cache.keys()) {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(IMAGE_PREFIX)) continue // 座標JSONは小さいので対象外
    const res = await cache.match(req)
    if (!res) continue
    const bytes = Number(res.headers.get('content-length') ?? 0)
    total += bytes
    entries.push({ key: req.url, bytes, at: res.headers.get(CACHED_AT_HEADER) ?? '' })
  }
  if (total <= MAX_BYTES) return
  entries.sort((a, b) => a.at.localeCompare(b.at)) // 古い順
  for (const e of entries) {
    if (total <= MAX_BYTES) break
    if (protectedKeys.has(new URL(e.key).pathname)) continue
    if (await cache.delete(e.key)) total -= e.bytes
  }
}

/**
 * 表示に使うURLを決める。
 *  - キャッシュ済み & SW が制御中 → 合成URL（ネットワークに出ない。オフラインでも表示できる）
 *  - それ以外 → 署名URL（従来どおり）。オンラインなら裏でキャッシュに写しておき、次回から効かせる。
 * 署名URLを先に返すのは、大きな画像をダウンロードし切るまで待たずに描画を始めるため。
 */
export async function resolveImageSrc(path: string): Promise<string> {
  const cache = await openCache()
  if (cache && swControlled() && (await cache.match(problemImageUrl(path)))) {
    return problemImageUrl(path)
  }
  const url = await signedUrl(path)
  if (cache) void storeImage(path, url)
  return url
}

/**
 * 座標（denken_question_assets）を network-first で読む。
 * DBが唯一の正なので、オンラインなら必ず最新を見に行き、取れたものをキャッシュへ写す
 * （データ修正はSQLのUPDATE1行で入る・docs/data-correction-workflow.md §5-A）。
 * オフライン・取得失敗時のみ、前回の内容へ落ちる。
 */
export async function loadProblemAssets(questionId: string): Promise<QuestionAsset[]> {
  const cache = await openCache()
  try {
    const assets = await fetchAssets(questionId)
    if (cache) {
      await cache.put(
        assetsUrl(questionId),
        new Response(JSON.stringify(assets), { headers: { 'content-type': 'application/json' } }),
      )
    }
    return assets
  } catch (e) {
    const cached = cache ? await cache.match(assetsUrl(questionId)) : null
    if (!cached) throw e
    // 正規化前に書かれた古いキャッシュ（数値が文字列のまま）もここで揃える。
    return ((await cached.json()) as QuestionAsset[]).map(normalizeAsset)
  }
}

/**
 * 「今日の分」の問題画像を先読みする（課題7c）。
 * 呼び出し側は今日のキュー（復習due＋新規着手枠）の question_id を渡すだけでよい。
 * 返り値は中断関数で、依存が変わった／画面を離れたときに残りを止める。
 *
 * 制約:
 *  - 画像が登録され得る問題（hasKnownAsset）だけを見る。無関係な問題でDBを叩かない。
 *  - このセッションで一度試した問題は再走査しない（記録のたびにキューが変わるため）。
 *  - データセーバー指定時は何もしない（従量制の回線で勝手に数十MBを取りに行かない）。
 */
export function prefetchProblemImages(questionIds: string[]): () => void {
  let cancelled = false
  const cancel = () => { cancelled = true }

  if (!cacheAvailable() || !navigator.onLine) return cancel
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return cancel

  const targets = questionIds.filter(id => hasKnownAsset(id) && !attempted.has(id)).slice(0, MAX_QUESTIONS)
  if (targets.length === 0) return cancel

  const run = async () => {
    const stored = new Set<string>()
    let next = 0
    const worker = async () => {
      while (!cancelled) {
        const id = targets[next++]
        if (id === undefined) return
        // 「試した」の印は実際に着手する直前に付ける。中断された回・走る前に捨てられた回が
        // 印だけ残すと、その問題は以後どの回でも拾われない（記録のたびにキューが変わり、
        // 実行前に作り直されるため）。着手時に付ければ、走った分だけが印になる。
        if (attempted.has(id)) continue
        attempted.add(id)
        try {
          const assets = await loadProblemAssets(id)
          for (const a of assets) {
            if (cancelled) return
            if (await storeImage(a.storage_path)) stored.add(problemImageUrl(a.storage_path))
          }
        } catch {
          attempted.delete(id) // 取れなかった問題は次の機会に再挑戦する
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!cancelled) await evictIfNeeded(stored)
  }

  // 起動直後の描画とサーバ取得を邪魔しない。requestIdleCallback が無ければ少し遅らせる。
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(() => { if (!cancelled) void run() })
  else setTimeout(() => { if (!cancelled) void run() }, 3000)

  return cancel
}

/**
 * 画像・座標のキャッシュを丸ごと捨てる（ログアウト時）。
 * 鍵は storage_path＝`{user_id}/...` なので他人の画像を掴むことはないが、
 * 端末を共有した場合に前のユーザーの画像が合成URLで開けてしまうため、明示的に消す。
 */
export async function clearProblemImageCache(): Promise<void> {
  attempted.clear()
  if (!cacheAvailable()) return
  try {
    await caches.delete(IMAGE_CACHE)
  } catch {
    // 消せなくても本体の動作には影響しない
  }
}
