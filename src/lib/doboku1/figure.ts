// 問題の図（denken3.dbk_figures・migration 036）の縮小と検証。すべて純関数。
// 画像はブラウザで縮小（長辺 MAX_SIDE・JPEG）してから base64 で保存する。

export const MAX_SIDE = 1280
export const MAX_BASE64 = 1_500_000   // migration 036 の CHECK と同じ
export const FIGURE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type FigureMime = typeof FIGURE_MIMES[number]

/** 長辺を MAX_SIDE 以下にした寸法（拡大はしない）。 */
export function fitSize(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  if (w <= 0 || h <= 0) throw new Error(`画像の寸法が不正: ${w}x${h}`)
  const s = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) }
}

/** 'data:image/jpeg;base64,xxxx' → { mime, data }。保存できない形式・大きさは理由を返す。 */
export function splitDataUrl(url: string): { mime: FigureMime; data: string } | { error: string } {
  const m = url.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return { error: '画像の形式を読めません' }
  if (!(FIGURE_MIMES as readonly string[]).includes(m[1])) return { error: `${m[1]} は保存できません（JPEG・PNG・WebP のみ）` }
  if (m[2].length > MAX_BASE64) return { error: '画像が大きすぎます（縮小後も 1.5MB を超えました）' }
  return { mime: m[1] as FigureMime, data: m[2] }
}

/** 表示用の data URL。 */
export function figureSrc(mime: string, data: string): string {
  return `data:${mime};base64,${data}`
}
