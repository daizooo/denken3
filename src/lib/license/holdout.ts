// 温存（hold-out）の解放判定（licensehub-expansion.md §8）。出題可否の判定はこのファイルの isAvailable 1か所に置く。
//
// 解放日は denken_settings.holdout_release_dates（JSONB。migration 024）に「温存グループ → 'YYYY-MM-DD'」で持つ。
// 未設定・不正な日付のグループは解放しない。温存グループの無いもの（null）は常に出題できる。
// 本番形式模試（§7）の年度の選択には使わない（R6〜R8 は模試としていつでも解ける。期限は textMock.ts の mockProgress）。

export interface HoldoutSettings {
  /** 温存グループ → 解放日（'YYYY-MM-DD'）。 */
  releaseDates: Record<string, string>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

/** DB の holdout_release_dates（JSONB）を読み取る。日付として不正な値は捨てる（＝未設定＝解放しない）。 */
export function parseReleaseDates(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (isDate(v)) out[k] = v
  return out
}

/** 温存グループが today（'YYYY-MM-DD'）の時点で解放済みか。グループなし（null）は常に true。未設定は false。 */
export function isAvailable(holdoutGroup: string | null | undefined, today: string, settings: HoldoutSettings): boolean {
  if (!holdoutGroup) return true
  const date = settings.releaseDates[holdoutGroup]
  return isDate(date) && today >= date
}
