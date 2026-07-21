// 問題画像（Supabase Storage）と MASTER 問題(question_id)を結ぶヘルパー。
// - ASSET_MAP: 取り込み時に「ドロップされたファイル名 → どの問題へ」を引くための静的マップ（章ごと）
// - fetchAssets / signedUrl: 閲覧時に DB(denken_question_assets) と 署名付きURL を取得
import { supabase } from './supabase'
import { DC_ASSETS } from '../data/dcAssets'

export type Region = 'top' | 'bottom' | null

export interface AssetRef {
  questionId: string
  region: Region
  sort: number
}

/** ファイル名 -> そのファイルが対応する問題（2問同居なら複数） */
export type AssetMap = Record<string, AssetRef[]>

// 章ごとのマッピングを統合（現状 DC のみ。章を増やしたらここへ足す）
export const ASSET_MAP: AssetMap = { ...DC_ASSETS }

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
  sort: number
}

/** 指定問題の画像アセットを sort 昇順で取得 */
export async function fetchAssets(questionId: string): Promise<QuestionAsset[]> {
  const { data, error } = await supabase
    .from('denken_question_assets')
    .select('storage_path, region, answer_x_pct, sort')
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
