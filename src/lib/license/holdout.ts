// 温存（hold-out）の解放判定（licensehub-expansion.md §8）。出題可否の判定はこのファイルの isAvailable 1か所に置く。
//
// 解放日は denken_settings.holdout_release_dates（JSONB。migration 024）に「温存グループ → 'YYYY-MM-DD'」で持つ。
// 未設定・不正な日付のグループは解放しない。温存グループの無いもの（null）は常に出題できる。
//
// 本番形式模試（§7）は年度×式（択一／選択式）の単位で選ぶ。本物の年度は、問の温存グループ（pilot-r7-rk・gate-r8）に
// 加えて、年度ごとの模試グループ（mock-r06 など。R08 は gate-r8）の解放日を過ぎるまで選べない（通し演習は3月以降。§8）。
// フィクスチャの年度（R98・R99）は模試グループを持たない。
import { FIXTURE_YEARS, holdoutGroupOf } from './ingest/schema.ts'

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

/** 本番形式模試の年度単位の温存グループ。フィクスチャは null、R08 は gate-r8、その他の本物の年度は mock-{年度}。 */
export function mockHoldoutGroupOf(year: string): string | null {
  if (FIXTURE_YEARS.includes(year)) return null
  return holdoutGroupOf(year, '') ?? `mock-${year.toLowerCase()}`
}

/** 模試の1回分（年度×式）を出題するのに解放が要る温存グループ（重複なし・定義順）。 */
export function paperHoldoutGroups(year: string, questionGroups: readonly (string | null)[]): string[] {
  const groups = [mockHoldoutGroupOf(year), ...questionGroups].filter((g): g is string => !!g)
  return [...new Set(groups)]
}

/** 模試の1回分を選べるか: 必要な温存グループがすべて解放済み。 */
export function isPaperAvailable(
  year: string, questionGroups: readonly (string | null)[], today: string, settings: HoldoutSettings,
): boolean {
  return paperHoldoutGroups(year, questionGroups).every(g => isAvailable(g, today, settings))
}

const GROUP_LABELS: Record<string, string> = {
  'pilot-r7-rk': 'R7 択一 労基・安衛（パイロット判定）',
  'gate-r8': 'R8 択一・選択式（5月末ゲート）',
}

/** 温存グループの表示名。 */
export function holdoutGroupLabel(group: string): string {
  if (GROUP_LABELS[group]) return GROUP_LABELS[group]
  const m = group.match(/^mock-([hr])(\d{2})$/)
  return m ? `${m[1].toUpperCase()}${Number(m[2])} 本番形式模試（通し演習）` : group
}
