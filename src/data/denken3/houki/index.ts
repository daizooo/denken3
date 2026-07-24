// 電験3種・法規 科目の定義。章・年度別データは順次追加する（§8 Phase 3）。
// 章が未収録の間はタブのみ表示され、進捗系テーブルは subject_id='houki' でスコープされる。
import type { SubjectDefinition } from '../../../domain/types'

export const HOUKI_SUBJECT: SubjectDefinition = {
  id: 'houki',
  name: '法規',
  chapters: [],
}
