// 日付ユーティリティ。タイムゾーンによる日付ズレを避けるための共通ヘルパー。

// 復習タブの日付タブ数（今日を含む1週間＋1日＝8日分）。
// これ以降（today+REVIEW_WINDOW_DAYS 以降）の問題は「◯/◯以降」タブにまとめる。
export const REVIEW_WINDOW_DAYS = 8

// "YYYY-MM-DD" を UTC正午の Date に変換（TZによる日付ズレを防ぐ）
export function dateAtUTCNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`)
}

// 現在の「今日」を JST(UTC+9) 基準の "YYYY-MM-DD" で返す。
// new Date().toISOString() は UTC基準のため、JSTの深夜〜午前9時は
// 前日扱いになってしまう。復習日の判定は必ずこの関数を使う。
export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" に日数を加算して "YYYY-MM-DD" を返す（TZ非依存）
export function addDaysStr(dateStr: string, days: number): string {
  const d = dateAtUTCNoon(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// timestamptz / date いずれの文字列でも "YYYY-MM-DD" に正規化する
export function toDateStr(v: string | null | undefined): string {
  if (!v) return ''
  return v.slice(0, 10)
}

export function formatDue(dateStr: string | null): string {
  if (!dateStr) return '未定'
  // 「今日」と予定日を同じ UTC正午基準で比較する。
  // 「今日」は JST基準で求める（UTCのままだと JST深夜〜午前9時に前日扱いになる）。
  const today = dateAtUTCNoon(todayJST())
  const due = dateAtUTCNoon(toDateStr(dateStr))
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}日遅延`
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  return `${diff}日後`
}

// "2026-07-20" → "7/20"
export function formatMD(dateStr: string | null): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// 次回復習日の緊急度に応じた文字色
export function dueColorClass(dateStr: string | null): string {
  const label = formatDue(dateStr)
  if (label.includes('遅延')) return 'text-red-500'
  if (label === '今日') return 'text-orange-500'
  return 'text-emerald-600'
}
