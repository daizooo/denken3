import { useEffect, useState } from 'react'
import { signedUrl } from '../../lib/assets'
import { paperImagePath } from '../../lib/mock'

// 年度別ペーパーの切り出し画像1枚を、非公開Storageの署名付きURLで表示する。
// 画像は「問題→ワンポイント解説→解答」が縦に並んだ1問1枚（物理クロップなし・§11.2）。
// showAnswer=false のとき answerYPct より下をマスクして解説・解答を隠す（CBT解答中）。
// zoom で横幅を拡大（ピンチ/横スクロール前提・§7.4(2)）。
export default function PaperImage({
  userId, paperId, filename, answerYPct = 100, showAnswer = true, zoom = false,
}: {
  userId: string
  paperId: string
  filename?: string
  answerYPct?: number
  showAnswer?: boolean
  zoom?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!filename) { setUrl(null); return }
    let alive = true
    setUrl(null); setErr(false)
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
  const masked = !showAnswer && answerYPct < 100
  return (
    <div className="overflow-auto rounded-xl bg-white shadow-sm">
      <div style={{ position: 'relative', width: zoom ? '180%' : '100%', maxWidth: zoom ? 'none' : '100%' }}>
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ width: '100%', display: 'block' }}
        />
        {masked && (
          <div
            style={{
              position: 'absolute', top: `${answerYPct}%`, left: 0, right: 0, bottom: 0,
              background: 'rgba(255,255,255,0.98)', borderTop: '1px dashed #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: 12 }}>解説（採点後に表示）</span>
          </div>
        )}
      </div>
    </div>
  )
}
