// 電験3種・機械 科目の定義。章は順次追加する（§8 Phase 3）。
// 章が未収録の間はタブのみ表示され、進捗系テーブルは subject_id='kikai' でスコープされる。
// 年度別（CBT模試）ペーパーは理論と同じ仕組みで先行収録する（令和7年下期〜）。
import type { SubjectDefinition } from '../../../domain/types'
import { KIKAI_PAPERS } from './papers'

export const KIKAI_SUBJECT: SubjectDefinition = {
  id: 'kikai',
  name: '機械',
  chapters: [],
  papers: KIKAI_PAPERS,
}
