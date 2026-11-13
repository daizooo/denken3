// 2級建設業経理士の「入門」（前提知識のノート＋基礎ドリル）の型（docs/design/kenkei2-primer.md）。
// 本文は Claude 作成（根拠未確認）。過去問と違いリポジトリに置く（第三者の著作物を含まないため）。

/** ノートの表。1列目が見出し。 */
export interface PrimerTable { columns: string[]; rows: string[][] }

/** 図解の中の箱。sub は小さく添える説明（勘定名・金額など）。 */
export interface FigBox { label: string; sub?: string }

/** 色の名前（任意の CSS 色は使えない。図の見た目をそろえるため）。 */
export type DrawColor = 'soil' | 'water' | 'concrete' | 'steel' | 'accent' | 'warn' | 'gray' | 'white' | 'none'

/** draw 図の部品。座標は図の width×height（viewBox）の中。 */
export type DrawShape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: DrawColor; stroke?: DrawColor; dash?: boolean }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: DrawColor; stroke?: DrawColor }
  | { t: 'poly'; points: [number, number][]; fill?: DrawColor; stroke?: DrawColor; dash?: boolean }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: DrawColor; dash?: boolean; arrow?: boolean; both?: boolean; width?: number }
  | { t: 'text'; x: number; y: number; s: string; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; color?: DrawColor }

/**
 * ノートの図解（宣言的。画面側で描く）。
 * - flow: 箱を矢印でつなぐ。next は次の箱へのつなぎの文字（既定 →。計算式なら × − ＝ など）
 * - funnel: 左（上）の複数の箱が真ん中の箱に集まり、右（下）の箱へ分かれる
 * - sides: 左右2つの囲み（借方／貸方、貸借対照表／損益計算書など）
 * - taccount: T字勘定（借方が左・貸方が右）
 * - grid: 見出しをグループ化した表（精算表・数値例）。hi は強調する [行, 列] の位置
 * - draw: 断面図・構造図などの線画（DrawShape の並び。座標は 0〜width／0〜height。docs/design/primer-figures.md）
 */
export type PrimerFigure =
  | { kind: 'flow'; caption?: string; steps: (FigBox & { next?: string })[] }
  | { kind: 'funnel'; caption?: string; sources: FigBox[]; hub: FigBox; outs?: FigBox[] }
  | { kind: 'sides'; caption?: string; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { kind: 'taccount'; caption?: string; accounts: { name: string; debit: string[]; credit: string[] }[] }
  | { kind: 'grid'; caption?: string; groups: { title: string; cols: string[] }[]; rows: string[][]; hi?: [number, number][] }
  | { kind: 'draw'; caption?: string; width: number; height: number; shapes: DrawShape[] }

/** ノートの1節。body は段落（1要素 = 1段落）。figures は本文の後・表の前に出す。 */
export interface PrimerSection { heading: string; body: string[]; figures?: PrimerFigure[]; table?: PrimerTable }

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
