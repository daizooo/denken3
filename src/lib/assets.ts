// 問題画像（Supabase Storage）と MASTER 問題(question_id)を結ぶヘルパー。
// - ASSET_MAP: 取り込み時に「ドロップされたファイル名 → どの問題へ」を引くための静的マップ（章ごと）
// - fetchAssets / signedUrl: 閲覧時に DB(denken_question_assets) と 署名付きURL を取得
import { supabase } from './supabase'
import { DC_ASSETS } from '../data/dcAssets'
import { AC1_ASSETS } from '../data/ac1Assets'
import { TRANS_ASSETS } from '../data/transAssets'
import { AC3_ASSETS } from '../data/ac3Assets'
import { ELEC_ASSETS } from '../data/elecAssets'
import { MAG_ASSETS } from '../data/magAssets'
import { MEAS_ASSETS } from '../data/measAssets'
import { ETHEORY_ASSETS } from '../data/etheoryAssets'
import { ECIRCUIT_ASSETS } from '../data/ecircuitAssets'

export type Region = 'top' | 'bottom' | null

export interface AssetRef {
  questionId: string
  region: Region
  sort: number
  // 解答マスクの横位置(%)。この位置より右を解答として隠す。
  //  - 50（既定・見開き標準）: 左ページ=問題／右ページ=解答。
  //  - 100: 画像全体が問題（マスクなし・常時表示）。B問題で図が右ページまで及ぶ場合など。
  //  - 0:   画像全体が解答（見開き丸ごと解答／解答の続きページ）。「解答を見る」まで非表示。
  // 未指定時の既定は sort で決める（sort=0→50 の問題見開き、sort>0→0 の解答続き）。
  answerXPct?: number
  answerYPct?: number // 短い問題で解答が左ページ下に始まる場合の縦位置(%)。既定100=標準
  // 右ページの解答マスクを縦にずらす位置(%)。既定0=右ページ全体が解答。
  // 右ページの上部が問題の続き（小問(b)や選択肢）で、その下から解答が始まる見開き用。
  answerRightYPct?: number
  // 2問同居画像(region top/bottom)の上下分割位置(%)。既定50=画像のちょうど半分。
  // 2問目の見出しが中央にかからない画像は、この値で境界を実レイアウトに合わせる。
  regionYPct?: number
}

// 取り込み時に DB へ書く answer_x_pct を決める。明示指定を優先し、
// 無ければ「主画像(sort=0)=問題見開き50」「続き画像(sort>0)=解答ページ0」を既定とする。
export function defaultAnswerXPct(ref: AssetRef): number {
  return ref.answerXPct ?? (ref.sort > 0 ? 0 : 50)
}

/** ファイル名 -> そのファイルが対応する問題（2問同居なら複数） */
export type AssetMap = Record<string, AssetRef[]>

// 章コード -> その章のマッピング（章を増やしたらここへ足す）。
// 取り込みは必ず章を1つ選んで行うため、ファイル名の解決はこの章スコープで引く
// （`問1.png` のような章ローカルな命名は章をまたぐと一意にならないため・src/lib/bunyaFilename.ts）。
export const CHAPTER_ASSET_MAPS: Record<string, AssetMap> = {
  dc: DC_ASSETS,
  ac1: AC1_ASSETS,
  trans: TRANS_ASSETS,
  ac3: AC3_ASSETS,
  elec: ELEC_ASSETS,
  mag: MAG_ASSETS,
  meas: MEAS_ASSETS,
  etheory: ETHEORY_ASSETS,
  ecircuit: ECIRCUIT_ASSETS,
}

// 全章を統合したマッピング（「問題を見る」ボタンの表示判定・件数表示に使う）。
export const ASSET_MAP: AssetMap = Object.assign({}, ...Object.values(CHAPTER_ASSET_MAPS))

export const BUCKET = 'denken-problems'

// アプリに画像が登録され得る question_id 集合（「問題を見る」ボタンの表示判定に使う）
const QUESTION_IDS_WITH_ASSETS = new Set<string>(
  Object.values(ASSET_MAP).flatMap(refs => refs.map(r => r.questionId)),
)

export function hasKnownAsset(questionId: string): boolean {
  return QUESTION_IDS_WITH_ASSETS.has(questionId)
}

/** question_id 'dc_8' -> 章コード 'dc' */
export function chapterOf(questionId: string): string {
  return questionId.split('_')[0]
}

/** Storage 上のパス規約: {user_id}/theory/{chapter}/{filename} */
export function storagePath(userId: string, chapter: string, filename: string): string {
  return `${userId}/theory/${chapter}/${filename}`
}

export interface QuestionAsset {
  storage_path: string
  region: Region
  answer_x_pct: number
  answer_y_pct: number
  answer_right_y_pct: number
  region_y_pct: number
  sort: number
  // 年度別ペーパー（1問1枚・縦長）の表示範囲(%)。分野別の見開き画像では使わない。
  // DBが唯一の正で、修正はSQLのUPDATE1行で完結する（docs/data-correction-workflow.md §5-A）。
  question_start_pct: number  // 問題文が始まる縦位置。ここより上（タイトル・目次・難易度行）は常に隠す
  explanation_end_pct: number // 解説・解答の本文が終わる縦位置。ここより下（宣伝バナー等）は常に隠す
}

/** 指定問題の画像アセットを sort 昇順で取得 */
export async function fetchAssets(questionId: string): Promise<QuestionAsset[]> {
  const { data, error } = await supabase
    .from('denken_question_assets')
    .select('storage_path, region, answer_x_pct, answer_y_pct, answer_right_y_pct, region_y_pct, sort, question_start_pct, explanation_end_pct')
    .eq('question_id', questionId)
    .order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as QuestionAsset[]
}

/** 非公開バケットの短期署名付きURLを発行 */
export async function signedUrl(path: string, ttlSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}
