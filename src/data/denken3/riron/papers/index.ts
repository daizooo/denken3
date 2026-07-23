// 電験3種・理論の年度別ペーパー一覧（CBT模試）。
// 表示は配列順（直近回を先頭に）。収録が済んだ回から draft を外す。
//
// ビルド時チェック（§9）: 非draftペーパーは validatePaper で
// 満点100点・正答1〜5・重複ID・配点を検証し、不正ならモジュール読込時に throw する
// （＝ vite build / 開発サーバ起動時に即座に検出される）。draft は雛形のため対象外。
import type { PaperDefinition } from '../../../../domain/types'
import { validatePaper } from '../../../../lib/mock'
import { R8_1 } from './r8-1'
import { R7_2 } from './r7-2'

export const RIRON_PAPERS: PaperDefinition[] = [R8_1, R7_2]

for (const paper of RIRON_PAPERS) {
  const errors = validatePaper(paper)
  if (errors.length > 0) {
    throw new Error(`ペーパー定義エラー [${paper.id}]:\n  - ${errors.join('\n  - ')}`)
  }
}
