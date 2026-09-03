import { useEffect, useState } from 'react'
import { fetchAssets, signedUrl, type QuestionAsset } from '../../lib/assets'
import { legacyPaperImagePath, paperImagePath } from '../../lib/mock'

// 年度別ペーパーの切り出し画像1枚を、非公開Storageの署名付きURLで表示する。
// 画像は「タイトル・共有ボタン・動画・目次→問題→ワンポイント解説→解答→関連記事」が縦に
// 並んだ1問1枚（物理クロップなし・§11.2）。表示は常に questionStartPct〜endPct の範囲だけを
// 切り出す（上部の無関係な部分を常に隠し、CBT解答中はさらに answerYPct から下＝解説以降も隠す）。
// endPct は showAnswer=false のとき answerYPct、true のとき explanationEndPct
// （結果画面で解説・解答は見せるが、末尾の宣伝バナー・共有ボタン・おすすめ記事は隠す）。
// 表示幅は端末幅に自動で合わせ（画像は元が縦長1枚のため横は常に画面幅ちょうど）、
// 広い画面では FIT_MAX_PX で頭打ちにして拡大しすぎを防ぐ。zoom はそこからの倍率で、
// 1超では横スクロール前提で引き伸ばす（§7.4(2)・課題16）。
//
// 3つの座標は denken_question_assets が唯一の正（docs/data-correction-workflow.md §5-A）。
// questionId を渡すと fetchAssets() でDBの値を読み、画像URLと同時に解決してから描画する
// （props より後に届いて切り出し位置が飛ぶことがない）。props の値は「まだDBに行が無い
// ＝画像未取り込みの回」向けの既定値で、取り込み時に ImportPanel がその値をDBへ投入する。

// 1問ぶんを描く横幅の上限(px)。これより広い画面では中央寄せで頭打ちにする
// （元画像より大きく引き伸ばしてもぼやけるだけのため）。
const FIT_MAX_PX = 820

export default function PaperImage({
  userId, subjectId, paperId, filename, questionId, questionStartPct = 0, answerYPct = 100, explanationEndPct = 100, showAnswer = true, zoom = 1,
}: {
  userId: string
  subjectId: string
  paperId: string
  filename?: string
  questionId?: string
  questionStartPct?: number
  answerYPct?: number
  explanationEndPct?: number
  showAnswer?: boolean
  zoom?: number
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [asset, setAsset] = useState<QuestionAsset | null>(null)

  useEffect(() => {
    if (!filename) { setUrl(null); return }
    let alive = true
    setUrl(null); setErr(false); setNaturalSize(null); setAsset(null)
    // まず科目修飾の新パスを引き、無ければ旧パス（subjectId 導入前の理論画像）へフォールバックする。
    const newPath = paperImagePath(userId, subjectId, paperId, filename)
    const legacyPath = legacyPaperImagePath(userId, paperId, filename)
    const urlP = signedUrl(newPath).then(u => ({ u, path: newPath }))
      .catch(() => signedUrl(legacyPath).then(u => ({ u, path: legacyPath })))
    // DBの座標。question_id は科目をまたいで重複する（理論と機械の 'r6-2_b16' は別問題）ため、
    // 実際に表示する画像の storage_path が一致する行だけを採用する。
    // 取得に失敗しても表示は続行し、props の既定値へ静かに落とす。
    const assetP = questionId ? fetchAssets(questionId).catch(() => []) : Promise.resolve([])
    Promise.all([urlP, assetP])
      .then(([{ u, path }, assets]) => {
        if (!alive) return
        setAsset(assets.find(a => a.storage_path === path) ?? null)
        setUrl(u)
      })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [userId, subjectId, paperId, filename, questionId])

  if (!filename) return null
  if (err) return (
    <div className="bg-white rounded-xl p-6 text-center text-xs text-amber-600">
      画像が未取り込みです（{filename}）。取り込みパネルの「年度別」から登録してください。
    </div>
  )
  if (!url) return (
    <div className="bg-white rounded-xl p-10 text-center text-xs text-gray-400">読み込み中...</div>
  )

  // DBに行があればそれが正。無い（未取り込み）ときだけ PaperDefinition 側の既定値を使う。
  const start = asset?.question_start_pct ?? questionStartPct
  const answerY = asset?.answer_y_pct ?? answerYPct
  const explanationEnd = asset?.explanation_end_pct ?? explanationEndPct

  const endPct = showAnswer ? explanationEnd : answerY
  const startPct = Math.min(start, endPct)
  const span = Math.max(endPct - startPct, 1)
  // クロップ範囲の縦横比が判明するまでは全体表示（画像読み込み直後の一瞬）。
  const cropReady = naturalSize != null
  const aspectRatio = cropReady ? `${naturalSize.w} / ${naturalSize.h * (span / 100)}` : undefined
  const imgTopPct = -(startPct / span) * 100

  return (
    <div className="overflow-auto rounded-xl bg-white shadow-sm">
      <div
        style={{
          position: 'relative', margin: '0 auto',
          width: `${zoom * 100}%`, maxWidth: FIT_MAX_PX * zoom,
          overflow: 'hidden', aspectRatio,
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={e => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{
            position: cropReady ? 'absolute' : 'static',
            top: cropReady ? `${imgTopPct}%` : undefined,
            left: 0, width: '100%', display: 'block',
          }}
        />
      </div>
    </div>
  )
}
