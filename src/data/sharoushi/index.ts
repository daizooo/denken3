// 社会保険労務士の資格定義（licensehub-expansion.md §4.3・§4.5）。
// タブは学習10科目。章（論点グループ）と MasterQuestion は取り込み後に
// scripts/license/build-master.mjs が subjects/<code>.ts として生成する（手書きしない）。
// 試験日程（denken_exam_plans）の初期行は migration 021 で学習10科目ぶん作る。
import type { ExamDefinition, SubjectDefinition } from '../../domain/types'
import type { ScoringModel, ScoringSection } from '../../domain/scoring'

// 学習10科目（タブの並び = 学習順の既定。§10.1 の仮の順序）。
export const SHAROUSHI_SUBJECTS: SubjectDefinition[] = [
  { id: 'rouki',    name: '労基', chapters: [] },
  { id: 'anei',     name: '安衛', chapters: [] },
  { id: 'rousai',   name: '労災', chapters: [] },
  { id: 'koyou',    name: '雇用', chapters: [] },
  { id: 'choushu',  name: '徴収', chapters: [] },
  { id: 'kenpo',    name: '健保', chapters: [] },
  { id: 'kokunen',  name: '国年', chapters: [] },
  { id: 'kounen',   name: '厚年', chapters: [] },
  { id: 'rouippan', name: '労一', chapters: [] },
  { id: 'shaippan', name: '社一', chapters: [] },
]

// 採点科目コード → 含まれる学習科目ID（§4.3）。徴収は選択式に出ず、択一の労災・雇用の問8〜10に含まれる。
// IP（労一・社一の択一合算）の問番号の分割位置は取り込み時に検証する。
export const SHAROUSHI_SCORED_TO_STUDY: Record<string, string[]> = {
  RK: ['rouki', 'anei'],
  RS: ['rousai', 'choushu'],
  KY: ['koyou', 'choushu'],
  RI: ['rouippan'],
  SI: ['shaippan'],
  IP: ['rouippan', 'shaippan'],
  KH: ['kenpo'],
  KO: ['kounen'],
  KN: ['kokunen'],
}

// 閾値の設定値（年ごとに変わるため、ここ1か所で持つ）。
// 総得点の基準は暫定で R8 実績（択一47 / 選択式25）、目標は推奨値。足切りは原則値。
export const SHAROUSHI_THRESHOLDS: Record<ScoringSection['id'], { floor: number; passTotal: number; targetTotal: number }> = {
  taku:    { floor: 4, passTotal: 47, targetTotal: 50 },
  sentaku: { floor: 3, passTotal: 25, targetTotal: 30 },
}

const SCORED_NAMES: Record<string, string> = {
  RK: '労働基準法及び労働安全衛生法',
  RS: '労働者災害補償保険法',
  KY: '雇用保険法',
  RI: '労務管理その他の労働に関する一般常識',
  SI: '社会保険に関する一般常識',
  IP: '労一・社一',
  KH: '健康保険法',
  KO: '厚生年金保険法',
  KN: '国民年金法',
}

function section(
  id: ScoringSection['id'], name: string, timeLimitMin: number, codes: string[], maxPoints: number,
): ScoringSection {
  const t = SHAROUSHI_THRESHOLDS[id]
  return {
    id, name, timeLimitMin,
    subjects: codes.map(code => ({ code, name: SCORED_NAMES[code], maxPoints, floor: t.floor })),
    totalMax: codes.length * maxPoints,
    passTotal: t.passTotal,
    targetTotal: t.targetTotal,
  }
}

export const SHAROUSHI_SCORING: ScoringModel = {
  sections: [
    section('sentaku', '選択式', 80, ['RK', 'RS', 'KY', 'RI', 'SI', 'KH', 'KO', 'KN'], 5),
    section('taku', '択一式', 210, ['RK', 'RS', 'KY', 'IP', 'KH', 'KO', 'KN'], 10),
  ],
}

export const SHAROUSHI_EXAM: ExamDefinition = {
  id: 'sharoushi',
  name: '社労士',
  // 想定得点・ペース等（analytics/pace/policy）は100点・合格60点の前提のまま（§3.2、PR-L で ScoringModel 化）。
  // 社労士の合否は features.scoring で判定する。
  passingScore: 60,
  features: { subjectPass: false, twoStage: false, scoring: SHAROUSHI_SCORING, allText: true },
  subjects: SHAROUSHI_SUBJECTS,
}
