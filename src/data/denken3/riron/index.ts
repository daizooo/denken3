// 電験3種・理論 科目の定義。
// 現状は「オーム社 分野別過去問」章のみ。年度別（CBT模試）は Phase 2 で追加する。
import type { SubjectDefinition } from '../../../domain/types'
import { OHMSHA_BUNYA_CHAPTERS } from './ohmsha-bunya'

export const RIRON_SUBJECT: SubjectDefinition = {
  id: 'riron',
  name: '理論',
  chapters: OHMSHA_BUNYA_CHAPTERS,
}
