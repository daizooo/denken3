// 電験3種・電力 科目の定義。章・年度別データは順次追加する（§8 Phase 3）。
// 章が未収録の間はタブのみ表示され、進捗系テーブルは subject_id='denryoku' でスコープされる。
import type { SubjectDefinition } from '../../../domain/types'

export const DENRYOKU_SUBJECT: SubjectDefinition = {
  id: 'denryoku',
  name: '電力',
  chapters: [],
}
