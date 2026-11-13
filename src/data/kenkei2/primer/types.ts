// 2級建設業経理士の「入門」（前提知識のノート＋基礎ドリル）の型（docs/design/kenkei2-primer.md）。
// 本文は Claude 作成（根拠未確認）。過去問と違いリポジトリに置く（第三者の著作物を含まないため）。

/** ノートの表。1列目が見出し。 */
export interface PrimerTable { columns: string[]; rows: string[][] }

/** ノートの1節。body は段落（1要素 = 1段落）。 */
export interface PrimerSection { heading: string; body: string[]; table?: PrimerTable }

/** 基礎ドリル1問。仕訳は [記号, 金額] の組（記号は symbols.ts の科目群）。金額は円。 */
export type PrimerDrill =
  | { title: string; stem: string; kind: 'journal'; debit: [string, number][]; credit: [string, number][]; explain: string }
  | { title: string; stem: string; kind: 'amount'; value: number; explain: string }

/** 1テーマ（= 入門タブの1章）。 */
export interface PrimerTopic {
  /** 英小文字と数字だけ（ID `K2_P_<id>_<nn>` に使う。既存の値は変えない）。 */
  id: string
  name: string
  sections: PrimerSection[]
  drills: PrimerDrill[]
  /** 根拠（基準・テキストの名称）。 */
  basis: string
}
