// 出題年度・出題形式（択一式／選択式）の絞り込み（社労士の一覧・復習）。すべて純関数。
//
// 年度と形式は問・肢の ID（R06_T_RK_04_A / R06_S_RK_A）から読めるので、DB にも索引にも持たせない。
// 論点（章）は科目によって無い（雇用・健保・国年など）／多い（労基25）ため、論点の前段にこの2軸を置き、
// 章の選択肢の件数もこの絞り込みに連動させる（App 側）。ID として読めない問（電験など）は軸ごと出さない。
import { parseItemId, type LicFormat } from '../../domain/license'
import { yearLabelJa } from './idLabel'

export interface SourceSelection {
  years: ReadonlySet<string>
  formats: ReadonlySet<LicFormat>
}

export const FORMAT_ORDER: readonly LicFormat[] = ['taku', 'sentaku']
export const FORMAT_LABEL: Record<LicFormat, string> = { taku: '択一式', sentaku: '選択式' }

/** 空集合の軸は素通し。ID として読めない問は、どちらかの軸が有効なら除く。 */
export function matchSource(id: string, sel: SourceSelection): boolean {
  if (sel.years.size === 0 && sel.formats.size === 0) return true
  const c = parseItemId(id)
  if (!c) return false
  return (sel.years.size === 0 || sel.years.has(c.year)) && (sel.formats.size === 0 || sel.formats.has(c.format))
}

// 令和→平成の順、同じ元号では新しい年度から（R08, R07, …, R01, H30, H29）。
const yearRank = (y: string) => (y.startsWith('R') ? 1000 : 0) + Number(y.slice(1))

/** ids に出てくる年度（新しい順）。 */
export function yearsOf(ids: string[]): string[] {
  const set = new Set<string>()
  for (const id of ids) {
    const c = parseItemId(id)
    if (c) set.add(c.year)
  }
  return [...set].sort((a, b) => yearRank(b) - yearRank(a))
}

/** ids に出てくる形式（択一式→選択式の順）。 */
export function formatsOf(ids: string[]): LicFormat[] {
  const set = new Set<LicFormat>()
  for (const id of ids) {
    const c = parseItemId(id)
    if (c) set.add(c.format)
  }
  return FORMAT_ORDER.filter(f => set.has(f))
}

/** チップの表示（'R06' → '令和6'、'R01' → '令和元'、'H29' → '平成29'）。 */
export function yearChipLabel(year: string): string {
  return yearLabelJa(year).replace(/年度$/, '')
}
