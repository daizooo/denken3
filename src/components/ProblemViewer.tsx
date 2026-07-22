import { useEffect, useState } from 'react'
import { X, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react'
import { fetchAssets, signedUrl, type QuestionAsset, type Region } from '../lib/assets'

// 見開き画像1枚（またはその上/下半分）を、解答マスク付きで表示する。
// マスクは最大2枚:
//  - 右ページ（横 answerXPct% より右）を常に隠す
//  - 短い問題（answerYPct<100）は左ページ下部（縦 answerYPct% より下・左ページ内）も隠す
function AssetImage({
  url, region, answerXPct, answerYPct, showAnswer,
}: { url: string; region: Region; answerXPct: number; answerYPct: number; showAnswer: boolean }) {
  // 画像は 2360x1640。region 指定時は上/下半分だけを見せる。
  const ratio = region ? '2360 / 820' : '2360 / 1640'
  const top = region === 'bottom' ? '-100%' : '0'
  const maskBg = 'rgba(255,255,255,0.98)'
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: ratio, overflow: 'hidden', background: '#fff' }}>
      <img
        src={url}
        draggable={false}
        alt=""
        style={{ position: 'absolute', top, left: 0, width: '100%', display: 'block' }}
      />
      {!showAnswer && (
        <>
          {/* 右ページ（解答） */}
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: `${answerXPct}%`, right: 0,
              background: maskBg, borderLeft: '1px dashed #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: 12, writingMode: 'vertical-rl' }}>解答（タップで表示）</span>
          </div>
          {/* 左ページ下部（短い問題で解答が下に始まる場合） */}
          {answerYPct < 100 && (
            <div
              style={{
                position: 'absolute', top: `${answerYPct}%`, bottom: 0, left: 0, width: `${answerXPct}%`,
                background: maskBg, borderTop: '1px dashed #e5e7eb',
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export default function ProblemViewer({
  questionId, title, onClose,
}: { questionId: string; title: string; onClose: () => void }) {
  const [assets, setAssets] = useState<QuestionAsset[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showAnswer, setShowAnswer] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setAssets(null); setUrls({}); setShowAnswer(false); setErr(null)
    ;(async () => {
      try {
        const a = await fetchAssets(questionId)
        if (!alive) return
        setAssets(a)
        const map: Record<string, string> = {}
        for (const x of a) {
          if (!map[x.storage_path]) map[x.storage_path] = await signedUrl(x.storage_path)
        }
        if (alive) setUrls(map)
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : '読み込みに失敗しました')
      }
    })()
    return () => { alive = false }
  }, [questionId])

  const primary = assets?.filter(a => a.sort === 0) ?? []
  const continuations = assets?.filter(a => a.sort > 0) ?? []

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* トップバー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/95 shrink-0">
        <p className="text-sm font-medium text-gray-800 truncate flex-1">{title}</p>
        <button
          onClick={() => setZoom(z => !z)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          title={zoom ? '縮小' : '拡大'}
        >
          {zoom ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
        </button>
        <button
          onClick={() => setShowAnswer(s => !s)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
            showAnswer
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'bg-blue-600 text-white border-blue-600'
          }`}
        >
          {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
          {showAnswer ? '解答を隠す' : '解答を見る'}
        </button>
        <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="閉じる">
          <X size={18} />
        </button>
      </div>

      {/* 本体 */}
      <div className="flex-1 overflow-auto p-3">
        <div className="mx-auto" style={{ width: zoom ? '190%' : '100%', maxWidth: zoom ? 'none' : 900 }}>
          {err && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-red-500">{err}</div>
          )}
          {!err && assets === null && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-400">読み込み中...</div>
          )}
          {!err && assets !== null && assets.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
              この問題の画像はまだ取り込まれていません。<br />
              ヘッダーの「取り込み」から画像を登録してください。
            </div>
          )}
          {!err && primary.map((a, i) => (
            urls[a.storage_path]
              ? <div key={`p${i}`} className="rounded-xl overflow-hidden shadow-lg mb-3">
                  <AssetImage url={urls[a.storage_path]} region={a.region} answerXPct={a.answer_x_pct} answerYPct={a.answer_y_pct} showAnswer={showAnswer} />
                </div>
              : null
          ))}
          {/* 解答の続きページ（解答表示時のみ・マスクなし） */}
          {!err && showAnswer && continuations.map((a, i) => (
            urls[a.storage_path]
              ? <div key={`c${i}`} className="rounded-xl overflow-hidden shadow-lg mb-3">
                  <img src={urls[a.storage_path]} alt="" draggable={false} style={{ width: '100%', display: 'block' }} />
                </div>
              : null
          ))}
        </div>
      </div>
    </div>
  )
}
