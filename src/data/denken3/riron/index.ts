// 電験3種・理論 科目の定義。
// 「オーム社 分野別過去問」章＋年度別（CBT模試）ペーパー（§8 Phase 2a）。
import type { SubjectDefinition } from '../../../domain/types'
import { buildSourceLinks } from '../../../lib/sourceLink'
import { OHMSHA_BUNYA_CHAPTERS } from './ohmsha-bunya'
import { RIRON_PAPERS } from './papers'

// 年度別→分野別の自動リンク（課題6・Phase E）。分野別タイトルの出典表記から組み立てる。
// 手入力の `PaperQuestion.sourceQuestionId` はこれより優先される（registry.sourceQuestionIdOf）。
// 分野別 全440問に出典を補記済み（§8.2）。ペーパーを新しく収録すれば自動でリンクが増える。
// errors は「収録済みの回に存在しない問番号」「同じ年度別問題への重複リンク」＝データの誤りのみ。
// ビルド時（モジュール読込時）に落として、出典の転記ミスをその場で検出する（papers/index.ts と同じ方針）。
const rironSourceLinks = buildSourceLinks(OHMSHA_BUNYA_CHAPTERS, RIRON_PAPERS)
if (rironSourceLinks.errors.length > 0) {
  throw new Error(`出典リンクエラー [riron]:\n  - ${rironSourceLinks.errors.join('\n  - ')}`)
}
// 出典が「収録済みの回」を指しているのに問番号が無くリンクできなかった問題（＝補記待ちの一覧）。
// データの誤りではないので落とさず、開発時だけ知らせる。
if (import.meta.env.DEV && rironSourceLinks.incomplete.length > 0) {
  console.warn(`[riron] 出典に問番号が無くリンクできない分野別問題: ${rironSourceLinks.incomplete.join(', ')}`)
}

export const RIRON_SUBJECT: SubjectDefinition = {
  id: 'riron',
  name: '理論',
  chapters: OHMSHA_BUNYA_CHAPTERS,
  papers: RIRON_PAPERS,
  sourceLinks: rironSourceLinks.links,
}
