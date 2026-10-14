// 法改正フラグの SQL 生成（PR-K）。実行の確認はローカルの PostgreSQL で行う（docs/license-law-review.md）。
import { describe, expect, it } from 'vitest'
import { LAW_RISK_MARKER, LAW_RISK_RULES } from './lawRisk'
import { toLawRiskApplySql, toLawRiskCheckSql, toLawRiskRollbackSql } from './lawRiskSql'

const USER = '00000000-0000-4000-8000-000000000001'

describe('toLawRiskCheckSql', () => {
  const sql = toLawRiskCheckSql({ baseDate: '2026-04-10', userId: USER })
  it('読み出しのみ（更新・トランザクションを含まない）', () => {
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|BEGIN|COMMIT)\b/)
  })
  it('規則を lawRisk.ts と同じ並びで埋め込む', () => {
    for (const r of LAW_RISK_RULES) expect(sql).toContain(`'${r.pattern}'`)
  })
  it('公式PDF由来の unchecked だけを対象にし、フィクスチャの年度を除く', () => {
    expect(sql).toContain("i.law_status = 'unchecked'")
    expect(sql).toContain("q.source = 'honshiken'")
    expect(sql).toContain("q.year NOT IN ('R98', 'R99')")
    expect(toLawRiskCheckSql({ baseDate: '2026-04-10', userId: USER, includeFixture: true })).not.toContain('NOT IN')
  })
})

describe('toLawRiskApplySql', () => {
  const sql = toLawRiskApplySql({ baseDate: '2026-04-10', userId: USER })
  it('トランザクションで review にし、基準日つきの注記を追記する', () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*UPDATE lic_items i[\s\S]*COMMIT;/)
    expect(sql).toContain("SET law_status = 'review'")
    expect(sql).toContain(`'${LAW_RISK_MARKER} 法令基準日 2026-04-10 時点で要確認（'`)
  })
  it('冪等: unchecked だけを更新し、注記が既にあれば足さない', () => {
    expect(sql).toMatch(/WHERE i\.user_id = .* AND i\.id = c\.id AND i\.law_status = 'unchecked'/)
    expect(sql).toContain(`WHEN position('${LAW_RISK_MARKER}' IN COALESCE(i.law_note, '')) > 0 THEN i.law_note`)
  })
  it('利用者の指定が無ければ、利用者が1人であることを確かめる', () => {
    const s = toLawRiskApplySql({ baseDate: '2026-04-10' })
    expect(s).toContain('RAISE EXCEPTION')
    expect(s).toContain('(SELECT id FROM auth.users)')
  })
  it('基準日・利用者の形式が不正なら作らない', () => {
    expect(() => toLawRiskApplySql({ baseDate: '2026/04/10' })).toThrow('YYYY-MM-DD')
    expect(() => toLawRiskApplySql({ baseDate: '2026-04-10', userId: 'x' })).toThrow('UUID')
  })
})

describe('toLawRiskRollbackSql', () => {
  const sql = toLawRiskRollbackSql({ userId: USER })
  it('自動判定の注記があり、まだ review の肢だけを unchecked に戻す', () => {
    expect(sql).toContain("SET law_status = 'unchecked'")
    expect(sql).toContain("AND i.law_status = 'review'")
    expect(sql).toContain(`position('${LAW_RISK_MARKER}' IN COALESCE(i.law_note, '')) > 0`)
  })
  it('自動判定の行だけを消す（他の注記は残す）', () => {
    expect(sql).toContain("regexp_replace(i.law_note, '\\n?\\[法改正の自動判定\\][^\\n]*', '', 'g')")
  })
})
