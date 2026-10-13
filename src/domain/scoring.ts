// 科目別の配点・足切りモデル（licensehub-expansion.md §4.3）。
// 資格の採点構造（式ごとの科目・満点・足切り・総得点基準）を表し、得点から合否を判定する純関数を置く。
// 閾値（floor / passTotal / targetTotal）はロジックに埋め込まず、各資格の data 側の設定値から渡す。

export interface ScoringSubject { code: string; name: string; maxPoints: number; floor: number }

export interface ScoringSection {
  id: 'taku' | 'sentaku'; name: string; timeLimitMin: number   // 択一210 / 選択式80
  subjects: ScoringSubject[]; totalMax: number                  // 70 / 40
  passTotal: number; targetTotal: number                        // 合格基準（総得点）/ 目標
}

export interface ScoringModel { sections: ScoringSection[] }

// 科目コード → 得点。未入力の科目は 0 点として扱う。
export type SubjectScores = Record<string, number>

export interface SectionJudgement {
  sectionId: ScoringSection['id']
  total: number
  passTotal: number
  targetTotal: number
  meetsTotal: boolean          // 総得点が合格基準以上
  meetsTarget: boolean         // 総得点が目標以上
  floorFailures: string[]      // 足切りにかかった科目コード（定義順）
  passed: boolean              // 総得点を満たし、足切り科目が無い
}

export interface ScoringJudgement {
  sections: SectionJudgement[]
  passed: boolean              // 全セクションが合格
}

// 1セクション（択一式・選択式）の判定。
// floorOverrides は年ごとの足切り補正（例: 選択式のある科目を3点→2点）を科目コードで上書きする。
export function judgeSection(
  section: ScoringSection, scores: SubjectScores, floorOverrides: Record<string, number> = {},
): SectionJudgement {
  let total = 0
  const floorFailures: string[] = []
  for (const s of section.subjects) {
    const pts = scores[s.code] ?? 0
    total += pts
    if (pts < (floorOverrides[s.code] ?? s.floor)) floorFailures.push(s.code)
  }
  const meetsTotal = total >= section.passTotal
  return {
    sectionId: section.id,
    total,
    passTotal: section.passTotal,
    targetTotal: section.targetTotal,
    meetsTotal,
    meetsTarget: total >= section.targetTotal,
    floorFailures,
    passed: meetsTotal && floorFailures.length === 0,
  }
}

// 全セクションの判定。scores / floorOverrides はセクションID → 科目別の値。
export function judgeScoring(
  model: ScoringModel,
  scores: Partial<Record<ScoringSection['id'], SubjectScores>>,
  floorOverrides: Partial<Record<ScoringSection['id'], Record<string, number>>> = {},
): ScoringJudgement {
  const sections = model.sections.map(sec => judgeSection(sec, scores[sec.id] ?? {}, floorOverrides[sec.id]))
  return { sections, passed: sections.every(s => s.passed) }
}
