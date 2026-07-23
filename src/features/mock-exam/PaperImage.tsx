import { useEffect, useState } from 'react'
import { signedUrl } from '../../lib/assets'
import { paperImagePath } from '../../lib/mock'

// 年度別ペーパーの切り出し画像1枚を、非公開Storageの署名付きURLで表示する。
// 問題画像・解説画像で共用。zoom で横幅を拡大（ピンチ/横スクロール前提・§7.4(2)）。
export default function PaperImage({
  userId, paperId, filename, zoom = false,
}: { userId: string; paperId: string; filename?: string; zoom?: boolean }) {
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
  return (
    <div className="overflow-auto rounded-xl bg-white shadow-sm">
      <img
        src={url}
        alt=""
        draggable={false}
        style={{ width: zoom ? '180%' : '100%', maxWidth: zoom ? 'none' : '100%', display: 'block' }}
      />
    </div>
  )
}
