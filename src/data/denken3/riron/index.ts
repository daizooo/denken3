// 電験3種・理論 科目の定義。
// 「オーム社 分野別過去問」章＋年度別（CBT模試）ペーパー（§8 Phase 2a）。
import type { SubjectDefinition } from '../../../domain/types'
import { OHMSHA_BUNYA_CHAPTERS } from './ohmsha-bunya'
import { RIRON_PAPERS } from './papers'

export const RIRON_SUBJECT: SubjectDefinition = {
  id: 'riron',
  name: '理論',
  chapters: OHMSHA_BUNYA_CHAPTERS,
  papers: RIRON_PAPERS,
}
