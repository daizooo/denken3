import { useEffect, useState } from 'react'
import { signedUrl } from '../../lib/assets'
import { paperImagePath } from '../../lib/mock'

// 年度別ペーパーの切り出し画像1枚を、非公開Storageの署名付きURLで表示する。
// 画像は「タイトル・共有ボタン・動画・目次→問題→ワンポイント解説→解答→関連記事」が縦に
// 並んだ1問1枚（物理クロップなし・§11.2）。表示は常に questionStartPct〜endPct の範囲だけを
// 切り出す（上部の無関係な部分を常に隠し、CBT解答中はさらに answerYPct から下＝解説以降も隠す）。
// endPct は showAnswer=false のとき answerYPct、true のとき explanationEndPct
// （結果画面で解説・解答は見せるが、末尾の宣伝バナー・共有ボタン・おすすめ記事は隠す）。
// zoom で横幅を拡大（ピンチ/横スクロール前提・§7.4(2)）。
export default function PaperImage({
  userId, paperId, filename, questionStartPct = 0, answerYPct = 100, explanationEndPct = 100, showAnswer = true, zoom = false,
}: {
  userId: string
  paperId: string
  filename?: string
  questionStartPct?: number
  answerYPct?: number
  explanationEndPct?: number
  showAnswer?: boolean
  zoom?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!filename) { setUrl(null); return }
    let alive = true
    setUrl(null); setErr(false); setNaturalSize(null)
    signedUrl(paperImagePath(userId, paperId, filename))
      .then(u => { if (alive) setUrl(u) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [userId, paperId, filename])

  if (!filename) return null
  if (err) return (
    <div className="bg-white rounded-xl p-6 text-center text-xs text-amber-600">
      画像が未取り込みです（{filename}）。取り込みパネルの「年度別」から登録してください。
    </div>
  )
  if (!url) return (
    <div className="bg-white rounded-xl p-10 text-center text-xs text-gray-400">読み込み中...</div>
  )

  const endPct = showAnswer ? explanationEndPct : answerYPct
  const startPct = Math.min(questionStartPct, endPct)
  const span = Math.max(endPct - startPct, 1)
  // クロップ範囲の縦横比が判明するまでは全体表示（画像読み込み直後の一瞬）。
  const cropReady = naturalSize != null
  const aspectRatio = cropReady ? `${naturalSize.w} / ${naturalSize.h * (span / 100)}` : undefined
  const imgTopPct = -(startPct / span) * 100

  return (
    <div className="overflow-auto rounded-xl bg-white shadow-sm">
      <div
        style={{
          position: 'relative', width: zoom ? '180%' : '100%', maxWidth: zoom ? 'none' : '100%',
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
