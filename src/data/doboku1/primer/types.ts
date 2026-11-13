// 1級土木の「入門」（前提知識のノート＋○×一問一答）の型（docs/design/doboku1-primer.md）。
// 本文は Claude 作成（根拠未確認）。過去問と違いリポジトリに置く（第三者の著作物を含まないため）。
import type { PrimerSection } from '../../kenkei2/primer/types.ts'

/** ○×一問一答の1問。answer は記述が正しければ true（○）。 */
export interface D1PrimerQuiz { title: string; statement: string; answer: boolean; explain: string }

/** 1分野（= 入門タブの1章）。 */
export interface D1PrimerTopic {
  /** 学習分野ID（DOBOKU1_CATEGORIES の id。ID `D1_P_<id>_<nn>` に使う。既存の値は変えない）。 */
  id: string
  name: string
  sections: PrimerSection[]
  quizzes: D1PrimerQuiz[]
  /** 根拠（示方書・法令・指針の名称）。 */
  basis: string
}
