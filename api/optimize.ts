// POST /api/optimize — FSRS パラメータ w[] の学習と採用。
//
// Vercel Serverless Function（Node.js）。履歴 500件規模なら学習は 1秒未満で終わる
// （実測: 277アイテムで約 0.5秒）ので、非同期ジョブにはしていない。
//
// ■ 流れ
//   1. JWT を検証して実行ユーザーを確定（RLS でその人の行だけが見える）
//   2. review_history から学習データを組む
//   3. w[] を学習し、**既定パラメータと当てはまりを比べる**
//   4. 改善したときだけ採用し、全カードのスケジュールを引き直す
//
// ■ 採用ゲートを置く理由
// 本番データは演習 509件・学習アイテム 277件で、FSRS プロジェクトが推奨する 1,000件に
// 届いていない。実測では out-of-sample の logLoss が 0.2929 → 0.2726（-6.9%）、
// RMSE が 0.1141 → 0.0829（-27%）と改善したが、80%再標本での w[0..3]（初期安定度）の
// 変動係数は 15〜38% で安定しているとは言えない。
// 「学習したから使う」ではなく「良くなったから使う」にしておけば、母数が足りない時期に
// 誤った当てはめを固定してしまう事故を機構的に防げる（adaptive-fsrs-policy.md §4 の懸念③）。
//
// ■ apply=false（既定）
// 学習と評価だけ行い、結果を版として残す（adopted=false）。利用者は数字を見てから
// 採用を押す。画面に出ていない値を勝手に効かせない、という Phase A からの一貫した方針。

import { generatorParameters } from 'ts-fsrs'
import { authenticate, json, HttpError } from './_lib/auth.js'
import { buildTrainSet, type TrainReview } from './_lib/trainSet.js'
import { reschedule } from './_lib/reschedule.js'

// オプティマイザ（fsrs-rs の NAPI ネイティブバインディング）は**遅延読み込みする**。
//
// トップレベルで import すると、プラットフォーム用のバイナリが同梱されなかった場合に
// モジュールの評価そのものが失敗し、Vercel は FUNCTION_INVOCATION_FAILED しか返さない
// ―― ログにも何も出ず、原因が分からない。ここで捕まえて理由を本文に載せる。
type Binding = typeof import('@open-spaced-repetition/binding')
let bindingPromise: Promise<Binding> | null = null

async function loadBinding(): Promise<Binding> {
  bindingPromise ??= import('@open-spaced-repetition/binding')
  try {
    return await bindingPromise
  } catch (e) {
    bindingPromise = null
    const detail = e instanceof Error ? e.message : String(e)
    throw new HttpError(500, `FSRSオプティマイザを読み込めませんでした: ${detail}`)
  }
}

// スケジューリング側（src/lib/fsrs.ts）は enable_short_term=false で日単位に固定して
// いるので、学習も同じ設定で行う。ここがずれると学習した w[] は意味を失う。
const TRAIN_OPTIONS = { enableShortTerm: false }

// FSRS-6 の重みの個数。ts-fsrs@5 の既定 w もこの数で、食い違ったら採用しない。
const EXPECTED_W_LENGTH = 21

// 採用に必要な最小の改善幅（logLoss の相対値）。誤差程度の差で版を切り替えない。
const MIN_LOG_LOSS_GAIN = 0.01

// これ未満の学習アイテム数では最適化を試みない。オプティマイザ自身も NotEnoughData を
// 返すが、その手前で理由を明示して返したほうが画面に出す言葉が正確になる。
const MIN_ITEMS = 100

// 保存に失敗したときの文言。
// テーブルが無い場合は PostgREST が "Could not find the table ... in the schema cache" を
// 返すが、これだけでは画面を見た人に何をすればよいか伝わらない。原因が「未適用の
// マイグレーション」であることは分かっているので、そこまで書く。
function saveErrorMessage(detail: string): string {
  if (detail.includes('denken_fsrs_params')) {
    return 'パラメータの保存先テーブルがありません。'
      + 'supabase/migrations/018_fsrs_params.sql を適用してください'
  }
  return `パラメータの保存に失敗しました: ${detail}`
}

function toItems(binding: Binding, items: TrainReview[][]) {
  return items.map(seq =>
    new binding.FSRSBindingItem(
      seq.map(r => new binding.FSRSBindingReview(r.rating, r.deltaT)),
    ),
  )
}

// **名前付きメソッドで export する。**
// `export default (req) => Response` は Vercel の Node ランタイムでは旧来の
// `(req, res) => void` シグネチャとして解釈され、**返した Response は捨てられる**。
// レスポンスが書かれないまま関数がぶら下がり、60秒でタイムアウト（504）になる。
// Web 標準の Request/Response を使う場合は、`fetch` か HTTP メソッド名で export する。
export async function POST(req: Request): Promise<Response> {
  try {
    const { supabase, userId } = await authenticate(req)

    const body = await req.json().catch(() => ({})) as { examId?: string; apply?: boolean }
    const examId = body.examId ?? 'denken3'
    const apply = body.apply === true

    // ---- 1. 履歴を読む（RLS により自分の行だけ） ----
    const { data: rows, error: readError } = await supabase
      .from('denken_reviews')
      .select('question_id, review_history')
      .eq('user_id', userId)
      .eq('exam_id', examId)
    if (readError) throw new HttpError(500, `履歴の取得に失敗しました: ${readError.message}`)

    const { items, stats } = buildTrainSet(rows ?? [])

    if (stats.items < MIN_ITEMS) {
      return json({
        ok: true, adopted: false, reason: 'not_enough_data', stats,
        message: `学習アイテムが ${stats.items} 件で、最適化に必要な ${MIN_ITEMS} 件に届いていません`,
      })
    }

    // ---- 2. 学習と評価 ----
    const binding = await loadBinding()
    const trainSet = toItems(binding, items)
    // 比較対象は **アプリが実際に使っている既定パラメータ**（ts-fsrs の初期値）にする。
    // fsrs-rs 側の既定に任せると、採用ゲートが本番の挙動とは別のものを基準にしてしまう。
    // 既定は学習しないので、訓練データ上の評価がそのまま当てはまりになる。
    const before = new binding.FSRSBinding(generatorParameters({}).w as number[]).evaluate(trainSet)
    // 学習側は時系列分割（前半で学習し後半で評価）なので、過学習は数字に出る。
    let after: { logLoss: number; rmseBins: number }
    let w: number[]
    try {
      after = await binding.evaluateWithTimeSeriesSplits(trainSet, TRAIN_OPTIONS)
      w = await binding.computeParameters(trainSet, TRAIN_OPTIONS)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!message.includes('NotEnoughData')) throw e
      return json({ ok: true, adopted: false, reason: 'not_enough_data', stats, message })
    }

    const metrics = {
      logLoss: { before: before.logLoss, after: after.logLoss },
      rmse: { before: before.rmseBins, after: after.rmseBins },
    }
    const gain = (before.logLoss - after.logLoss) / before.logLoss

    let reason: string | null = null
    if (w.length !== EXPECTED_W_LENGTH) reason = 'unexpected_w_length'
    else if (gain < MIN_LOG_LOSS_GAIN) reason = 'no_improvement'

    // ---- 3. 版として残す（採用しない場合も記録する） ----
    const { data: latest } = await supabase
      .from('denken_fsrs_params')
      .select('version')
      .eq('user_id', userId).eq('exam_id', examId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const version = (latest?.version ?? 0) + 1

    const adopted = apply && reason === null
    const { error: insertError } = await supabase.from('denken_fsrs_params').insert({
      user_id: userId, exam_id: examId, version, w,
      enable_short_term: TRAIN_OPTIONS.enableShortTerm,
      review_count: stats.reviews, item_count: stats.items,
      log_loss_before: metrics.logLoss.before, log_loss_after: metrics.logLoss.after,
      rmse_before: metrics.rmse.before, rmse_after: metrics.rmse.after,
      // 採用しなかった理由をそのまま残す。調べただけのときは 'dry_run'。
      adopted: false, reason: reason ?? (apply ? null : 'dry_run'),
    })
    if (insertError) throw new HttpError(500, saveErrorMessage(insertError.message))

    if (!adopted) {
      return json({
        ok: true, adopted: false, version, w, stats, metrics, gain,
        reason: reason ?? 'dry_run',
      })
    }

    // ---- 4. 採用: 全カードのスケジュールを引き直す ----
    const { data: plan } = await supabase
      .from('denken_exam_plans')
      .select('exam_date')
      .eq('user_id', userId).eq('exam_id', examId)
      .order('exam_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    const updates = reschedule({
      rows: rows ?? [], userId, examId,
      examDate: plan?.exam_date ?? null,
      version, w,
    })

    // 採用フラグを先に立てる。部分ユニークインデックスが「採用中は1件」を保証するので、
    // 旧版を降ろしてから上げる（同時に2件 adopted になる瞬間を作らない）。
    await supabase.from('denken_fsrs_params')
      .update({ adopted: false })
      .eq('user_id', userId).eq('exam_id', examId).eq('adopted', true)
    const { error: adoptError } = await supabase.from('denken_fsrs_params')
      .update({ adopted: true, reason: null })
      .eq('user_id', userId).eq('exam_id', examId).eq('version', version)
    if (adoptError) throw new HttpError(500, `採用に失敗しました: ${adoptError.message}`)

    // 1回の upsert（＝1トランザクション）で全行を更新する。分割すると途中で失敗したとき、
    // 一部だけ新しい版でスケジュールされた状態が残る。
    if (updates.length > 0) {
      const { error: writeError } = await supabase
        .from('denken_reviews')
        .upsert(updates, { onConflict: 'user_id,exam_id,question_id' })
      if (writeError) {
        // 書き込めなかったのに採用済みのままだと、DBの予定日と再生結果が食い違う。
        await supabase.from('denken_fsrs_params')
          .update({ adopted: false, reason: 'reschedule_failed' })
          .eq('user_id', userId).eq('exam_id', examId).eq('version', version)
        throw new HttpError(500, `スケジュールの更新に失敗しました: ${writeError.message}`)
      }
    }

    return json({
      ok: true, adopted: true, version, w, stats, metrics, gain,
      rescheduled: updates.length,
    })
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: e instanceof Error ? e.message : '不明なエラー' }, 500)
  }
}
