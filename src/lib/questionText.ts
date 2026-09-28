// 会社（暗記）向け問題のテキスト転記。
//
// denken3 は問題文・選択肢・解説を画像（Supabase Storage の切り出し画像）でのみ保持しており、
// テキストのデータは持っていなかった。会社では周囲の目があり画像を開けないため、メモ帳へ
// 貼り付けて解ける「テキスト化された問題」だけを別データとして持つ（画像データの置き換えではなく併存）。
//
// 転記データは scripts/fetch-question-images.mjs で画像を取得し、Claude Code セッションが
// 書き起こした結果を scripts/save-question-text.mjs で保存する（§docs/question-text-ocr.md）。
// 図がないと解けない問題（回路図・グラフ必須）は、書き起こし時の判断で最初からここに入らない
// —— 会社では図をまじまじと見る問題は解けないため。
//
// 章ごとにファイルを分ける（CLAUDE.md「データ追加はファイル単位で分離する」）。新しい章を
// 追加したら、下のインポートと CHAPTER_TEXT_MAPS に1行足すだけで済む形にしてある。
import { DC_TEXT } from '../data/questionText/dc'
import { AC1_TEXT } from '../data/questionText/ac1'
import { TRANS_TEXT } from '../data/questionText/trans'
import { AC3_TEXT } from '../data/questionText/ac3'
import { ELEC_TEXT } from '../data/questionText/elec'
import { MAG_TEXT } from '../data/questionText/mag'
import { MEAS_TEXT } from '../data/questionText/meas'
import { ETHEORY_TEXT } from '../data/questionText/etheory'
import { ECIRCUIT_TEXT } from '../data/questionText/ecircuit'

export interface QuestionText {
  /** 問題文（数式・単位・ギリシャ文字は文字表記: Ω, μF, √3, cosθ 等） */
  prompt: string
  /** 選択肢（画像に印刷されている順のまま） */
  choices: string[]
  /** 正解の選択肢番号（1始まり） */
  answer: number
  /** 解説（画像の解説文をそのまま書き起こしたもの） */
  explanation: string
}

// 章コード -> その章の転記データ。中身が空でもファイルごと保持する
// （assets.ts の CHAPTER_ASSET_MAPS と同じ構成。新規転記は該当ファイルだけを触ればよい）。
export const CHAPTER_TEXT_MAPS: Record<string, Record<string, QuestionText>> = {
  dc: DC_TEXT,
  ac1: AC1_TEXT,
  trans: TRANS_TEXT,
  ac3: AC3_TEXT,
  elec: ELEC_TEXT,
  mag: MAG_TEXT,
  meas: MEAS_TEXT,
  etheory: ETHEORY_TEXT,
  ecircuit: ECIRCUIT_TEXT,
}

// 全章を統合したマッピング（「テキストで解く」ボタンの表示判定に使う。ASSET_MAP と同じ形）。
export const QUESTION_TEXT: Record<string, QuestionText> = Object.assign({}, ...Object.values(CHAPTER_TEXT_MAPS))

export function hasQuestionText(questionId: string): boolean {
  return questionId in QUESTION_TEXT
}

export function getQuestionText(questionId: string): QuestionText | undefined {
  return QUESTION_TEXT[questionId]
}

// メモ帳へ貼り付ける用のプレーンテキストを組み立てる。
// 解答・解説は下に大きく空行を挟み、貼り付け直後の画面には問題文と選択肢だけが見えるようにする
// （スクロールしない限り答えが目に入らない＝自分でネタバレしない設計）。
const ANSWER_GAP_LINES = 25

export function formatForClipboard(title: string, text: QuestionText): string {
  const choiceLines = text.choices.map((c, i) => `${i + 1}) ${c}`).join('\n')
  const gap = '\n'.repeat(ANSWER_GAP_LINES)
  return [
    `【${title}】`,
    '',
    text.prompt,
    '',
    choiceLines,
    '',
    'あなたの答え：',
    gap,
    `【正解】${text.answer}`,
    `【解説】${text.explanation}`,
  ].join('\n')
}
