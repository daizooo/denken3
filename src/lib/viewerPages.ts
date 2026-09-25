// 分野別（見開きスキャン）ビューアの「どの範囲を1ページとして描くか」だけを決める純関数群。
//
// ProblemViewer から切り出してある。表示の良し悪しはここの矩形がすべてで、
// UI を起動せずに検証できる形にしておきたいため（src/lib/viewerPages.test.ts）。
//
// 前提: 画像は A4 見開きのスキャン1枚（左ページ＝問題／右ページ＝解答が標準）。
// 座標はすべて「画像全体に対する%」で、画像そのものは一切加工しない。
import type { QuestionAsset, Region } from './assets'

/** 画像内の切り出し範囲（画像全体に対する%）。 */
export interface Rect { x0: number; x1: number; y0: number; y1: number }

/** 見開きの綴じ目（画像全体に対する%）。左ページ／右ページの境界。 */
export const GUTTER_X = 50

/**
 * 綴じ目で割った結果、これより細い断片はページとして扱わない（%）。
 * マスク位置が綴じ目から少しずれている画像で、数%だけの無意味なページが増えるのを防ぐ。
 */
export const MIN_PAGE_W = 15

/**
 * 2問同居画像（region top/bottom）の、この問題が使う縦の帯。
 * answer_y_pct / answer_right_y_pct はこの帯に対する%で入っている。
 */
export function bandOf(a: QuestionAsset): { start: number; span: number } {
  const ry = a.region_y_pct ?? 50
  const region: Region = a.region
  if (region === 'top') return { start: 0, span: ry }
  if (region === 'bottom') return { start: ry, span: 100 - ry }
  return { start: 0, span: 100 }
}

/**
 * 問題として見せる範囲。1枚の見開きから最大2つ出る:
 *  - 左ページ（短い問題なら answer_y_pct まで）
 *  - 右ページ上部（answer_right_y_pct>0 ＝ 小問(b)や選択肢が右ページ上部へ続く見開き）
 * 丸ごと解答のページ（answer_x_pct<=0）は問題側に無い。
 */
export function problemRects(a: QuestionAsset): Rect[] {
  if (a.answer_x_pct <= 0) return []
  const b = bandOf(a)
  const out: Rect[] = [{
    x0: 0, x1: a.answer_x_pct,
    y0: b.start, y1: b.start + b.span * (a.answer_y_pct / 100),
  }]
  const rightTop = a.answer_right_y_pct ?? 0
  if (a.answer_x_pct < 100 && rightTop > 0) {
    out.push({ x0: a.answer_x_pct, x1: 100, y0: b.start, y1: b.start + b.span * (rightTop / 100) })
  }
  return out
}

/**
 * 解答として見せる範囲。1枚の見開きから最大2つ出る:
 *  - 左ページ下部（短い問題で解答が下に始まる場合・answer_y_pct<100）
 *  - 右ページ（標準の見開き・answer_right_y_pct から下）
 * 全面問題（answer_x_pct=100 かつ answer_y_pct=100）はこの画像に解答が無く、
 * 続きの「丸ごと解答ページ」が受け持つ。
 */
export function answerRects(a: QuestionAsset): Rect[] {
  const b = bandOf(a)
  const end = b.start + b.span
  if (a.answer_x_pct <= 0) return [{ x0: 0, x1: 100, y0: b.start, y1: end }]
  const out: Rect[] = []
  if (a.answer_y_pct < 100) {
    out.push({ x0: 0, x1: a.answer_x_pct, y0: b.start + b.span * (a.answer_y_pct / 100), y1: end })
  }
  if (a.answer_x_pct < 100) {
    out.push({ x0: a.answer_x_pct, x1: 100, y0: b.start + b.span * ((a.answer_right_y_pct ?? 0) / 100), y1: end })
  }
  return out
}

/**
 * 綴じ目をまたぐ範囲（見開き丸ごと）を、左右1ページずつに割る。
 * 割らずに1枚で描くと、画面幅に2ページぶんが入って文字が半分の大きさになる。
 * 1ページずつなら、どの端末でも常に「1ページが画面幅いっぱい」になる。
 */
export function splitAtGutter(r: Rect): Rect[] {
  const leftW = GUTTER_X - r.x0
  const rightW = r.x1 - GUTTER_X
  if (leftW < MIN_PAGE_W || rightW < MIN_PAGE_W) return [r]
  return [{ ...r, x1: GUTTER_X }, { ...r, x0: GUTTER_X }]
}

/** 1ページぶんの表示単位（どの画像の、どの範囲か）。 */
export interface Pane { path: string; rect: Rect }

/**
 * 表示するページの並び。sort ではなく answer_x_pct（マスク位置）で問題／解答を振り分ける:
 *  - 問題ページ（answer_x_pct>0）: 左ページ（と、短い問題ならその上部）が問題、残りが解答。
 *  - 解答ページ（answer_x_pct=0）: 見開き丸ごと解答。解答表示に切り替えるまで出さない。
 * 得られた範囲は綴じ目で割り、「1ページ＝1枚」に揃える。
 */
export function panesOf(assets: QuestionAsset[], showAnswer: boolean): Pane[] {
  const rectsOf = showAnswer ? answerRects : problemRects
  return assets
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .flatMap(a => rectsOf(a).flatMap(splitAtGutter).map(rect => ({ path: a.storage_path, rect })))
}
