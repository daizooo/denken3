// 電験3種の資格定義。
// 理論以外の科目（電力・機械・法規）は追加予定。
import type { ExamDefinition } from '../../domain/types'
import { RIRON_SUBJECT } from './riron'

export const DENKEN3_EXAM: ExamDefinition = {
  id: 'denken3',
  name: '電験3種',
  subjects: [RIRON_SUBJECT],
}
