// 法改正の確認状態（law_status）による出題・集計の可否（licensehub-expansion.md §9・PR-K）。純関数。
//
// 確認が済むまで unchecked / review の肢は、復習キュー・肢モード・一括コピー・集計に入れない（要確認一覧のみ）。
//   - 肢モード・一括コピー・一括記録: isAskableItem（itemBody.ts）が law_status='ok' だけを出す
//   - 復習キュー・集計: アプリはマスター索引（src/data/sharoushi/subjects）の肢から数えるため、
//     索引の生成（scripts/license/build-master.mjs）で ok 以外の肢を除く（filterLawCleared）
import type { LawStatus } from '../../domain/license'

/** 確認待ち（要確認一覧に出す）。 */
export const PENDING_LAW_STATUSES: readonly LawStatus[] = ['unchecked', 'review']

/** 要確認一覧で付けられる判定。 */
export const LAW_DECISIONS: readonly LawStatus[] = ['ok', 'review', 'excluded']

/** 出題・集計に入れてよいか（ok だけ）。値が無い・不明なものは入れない。 */
export function isLawCleared(status: string | null | undefined): boolean {
  return status === 'ok'
}

export function isLawPending(status: string | null | undefined): boolean {
  return (PENDING_LAW_STATUSES as readonly string[]).includes(status ?? '')
}

/** マスター索引に載せる肢（law_status='ok'）だけを残す。 */
export function filterLawCleared<T extends { law_status?: string | null }>(rows: T[]): { kept: T[]; dropped: T[] } {
  const kept: T[] = []
  const dropped: T[] = []
  for (const r of rows) (isLawCleared(r.law_status) ? kept : dropped).push(r)
  return { kept, dropped }
}

const DECISION_LABEL: Record<LawStatus, string> = { ok: '確認済み', review: '要確認', excluded: '除外', unchecked: '未確認' }

export function lawStatusLabel(status: LawStatus): string {
  return DECISION_LABEL[status]
}

/** 要確認一覧で判定したときに law_note へ追記する1行（基準日・判定日つき。既存の注記は消さない＝appendLawNote で足す）。 */
export function lawDecisionNote(status: LawStatus, text: string, baseDate: string, today: string): string {
  const body = text.replace(/\s+/g, ' ').trim()
  return `[判定 ${today} 基準日 ${baseDate}] ${DECISION_LABEL[status]}${body ? `: ${body}` : ''}`
}

export interface PendingGroup {
  year: string
  subject: string
  unchecked: number
  review: number
}

/** 確認待ちの肢を年度・科目（採点科目）別に数える。並びは年度の新しい順 → 科目コード順。 */
export function groupPending(rows: { year: string; subject: string; law_status: string }[]): PendingGroup[] {
  const m = new Map<string, PendingGroup>()
  for (const r of rows) {
    if (!isLawPending(r.law_status)) continue
    const k = `${r.year}\t${r.subject}`
    const g = m.get(k) ?? { year: r.year, subject: r.subject, unchecked: 0, review: 0 }
    if (r.law_status === 'review') g.review++
    else g.unchecked++
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => (a.year === b.year ? (a.subject < b.subject ? -1 : 1) : a.year < b.year ? 1 : -1))
}
