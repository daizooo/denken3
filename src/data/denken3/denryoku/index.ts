// 電験3種・電力 科目の定義。章データは順次追加する（§8 Phase 3）。
// 年度別（CBT模試）ペーパーを先行収録（令和7年度下期〜）。
// 章が未収録の間はタブのみ表示され、進捗系テーブルは subject_id='denryoku' でスコープされる。
import type { SubjectDefinition } from '../../../domain/types'
import { DENRYOKU_PAPERS } from './papers'

export const DENRYOKU_SUBJECT: SubjectDefinition = {
  id: 'denryoku',
  name: '電力',
  chapters: [],
  papers: DENRYOKU_PAPERS,
}
