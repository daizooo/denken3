#!/usr/bin/env node
// 修正が必要な問題画像を「Google Driveへ戻らず」確認するためのツール。
//
// 背景（docs/data-correction-workflow.md 参照）：
// 画像は取り込み時に既に Supabase Storage（非公開バケット denken-problems）へ
// アップロード済みで、denken_question_assets に question_id とパスが登録されている。
// にもかかわらず、修正のたびに元データのある Google Drive へ接続し直して再取得するのは、
// 「Supabase側に画像を確認する手段が無い」ことが原因。このスクリプトはその手段を作る。
//
// 使い方:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/peek-asset.mjs <question_id> [question_id...]
//
// SUPABASE_SERVICE_ROLE_KEY は RLS を bypass する強い権限のキーなので、
// リポジトリには絶対に置かず、実行時にローカル環境変数として渡すこと
// （docs/problem-data-integration.md §5 の方針と同じ）。
//
// 出力: 指定した question_id に紐づく denken_question_assets の全行（sort昇順）と、
// 各画像の短期署名付きURL。マスク座標（answer_x_pct/answer_y_pct）も一緒に表示するので、
// URLを開いて目視確認 → 数値がずれていれば直接 Supabase 側を修正、という流れで完結できる。
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TTL_SECONDS = Number(process.env.PEEK_TTL_SECONDS ?? 600)
const BUCKET = 'denken-problems'

const questionIds = process.argv.slice(2)

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  fail('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数で指定してください。')
}
if (questionIds.length === 0) {
  fail('question_id を1つ以上指定してください（例: node scripts/peek-asset.mjs dc_8 r7-1_a06）。')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function peek(questionId) {
  const { data: rows, error } = await supabase
    .from('denken_question_assets')
    .select('storage_path, region, sort, answer_x_pct, answer_y_pct, question_start_pct, explanation_end_pct')
    .eq('question_id', questionId)
    .order('sort', { ascending: true })

  if (error) {
    console.error(`✗ ${questionId}: ${error.message}`)
    return
  }
  if (!rows || rows.length === 0) {
    console.log(`⬜ ${questionId}: denken_question_assets に未登録（Supabase未取り込み。新規ならDriveから取り込みが必要）`)
    return
  }

  console.log(`\n■ ${questionId}（${rows.length}行）`)
  for (const row of rows) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, TTL_SECONDS)
    const region = row.region ?? 'full'
    console.log(
      `  sort=${row.sort} region=${region} answer_x_pct=${row.answer_x_pct} answer_y_pct=${row.answer_y_pct}\n` +
      // 年度別ペーパー（1問1枚の縦長画像）の表示範囲。分野別の見開き画像では使わない。
      `  question_start_pct=${row.question_start_pct} explanation_end_pct=${row.explanation_end_pct}\n` +
      `  path=${row.storage_path}`,
    )
    if (signErr) {
      console.log(`  ✗ 署名URL発行失敗: ${signErr.message}`)
    } else {
      console.log(`  url=${signed.signedUrl}（有効期限 ${TTL_SECONDS}秒）`)
    }
  }
}

for (const id of questionIds) {
  await peek(id)
}
