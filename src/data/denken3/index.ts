// 電験3種の資格定義。
// 科目は理論→電力→機械→法規の順で表示する。理論以外は章データを順次追加する（§8 Phase 3）。
import type { ExamDefinition } from '../../domain/types'
import { RIRON_SUBJECT } from './riron'
import { DENRYOKU_SUBJECT } from './denryoku'
import { KIKAI_SUBJECT } from './kikai'
import { HOUKI_SUBJECT } from './houki'

export const DENKEN3_EXAM: ExamDefinition = {
  id: 'denken3',
  name: '電験3種',
  passingScore: 60,
  features: { subjectPass: true, twoStage: false },
  subjects: [RIRON_SUBJECT, DENRYOKU_SUBJECT, KIKAI_SUBJECT, HOUKI_SUBJECT],
}
