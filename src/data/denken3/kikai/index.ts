// 電験3種・機械 科目の定義。章・年度別データは順次追加する（§8 Phase 3）。
// 章が未収録の間はタブのみ表示され、進捗系テーブルは subject_id='kikai' でスコープされる。
import type { SubjectDefinition } from '../../../domain/types'

export const KIKAI_SUBJECT: SubjectDefinition = {
  id: 'kikai',
  name: '機械',
  chapters: [],
}
