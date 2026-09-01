import { useEffect, useState } from 'react'
import { X, Eye, EyeOff, ZoomIn, ZoomOut, PauseCircle } from 'lucide-react'
import { fetchAssets, signedUrl, type QuestionAsset, type Region } from '../lib/assets'
import { STATUS_LABEL } from '../features/shared/status'
import type { Status } from '../domain/types'

// 見開き画像1枚（またはその上/下部分）を、解答マスク付きで表示する。
// マスクは最大2枚:
//  - 右ページ（横 answerXPct% より右・縦 answerRightYPct% より下）を隠す
//    （answerXPct=100 の全面問題ではマスクなし。answerRightYPct>0 は右ページ上部が問題の続きの見開き）
//  - 短い問題（answerYPct<100）は左ページ下部（縦 answerYPct% より下・左ページ内）も隠す
function AssetImage({
  url, region, regionYPct, answerXPct, answerYPct, answerRightYPct, showAnswer,
}: {
  url: string; region: Region; regionYPct: number
  answerXPct: number; answerYPct: number; answerRightYPct: number; showAnswer: boolean
}) {
  // 画像は 2360x1640。region 指定時は regionYPct を境に上/下だけを見せる（既定は半分）。
  const ratio = region === 'top' ? `2360 / ${16.4 * regionYPct}`
    : region === 'bottom' ? `2360 / ${16.4 * (100 - regionYPct)}`
      : '2360 / 1640'
  // 下バンドは、切り出した高さに対する上バンドの比率だけ画像を上へずらして見せる。
  const top = region === 'bottom' ? `-${(regionYPct / (100 - regionYPct)) * 100}%` : '0'
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
          {/* 右ページ（解答）。answerXPct=100（全面問題）はマスク不要。 */}
          {answerXPct < 100 && (
            <div
              style={{
                position: 'absolute', top: `${answerRightYPct}%`, bottom: 0, left: `${answerXPct}%`, right: 0,
                background: maskBg, borderLeft: '1px dashed #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: 12, writingMode: 'vertical-rl' }}>解答（タップで表示）</span>
            </div>
          )}
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
  questionId, title, onClose, onRecord, onAbort, solving = false,
}: {
  questionId: string
  title: string
  onClose: () => void
  // 理解度をこの画面から直接記録する（課題8）。押したらそのまま閉じる。
  onRecord?: (status: Status) => void
  // 「問題を解く」で開いた計測を破棄して閉じる（課題13）。育児中の中断は常態で、
  // 中断時間が解答時間に混ざると時間予算の見積もりが狂う。
  onAbort?: () => void
  // 解答時間を計測中か（「問題を解く」で開いたか）。中断ボタンの表示条件。
  solving?: boolean
}) {
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

  // 表示は sort ではなく answer_x_pct（マスク位置）で振り分ける:
  //  - 問題ページ（answer_x_pct>0）: 常時表示。1枚ごとに右（と下）を解答マスク。
  //    標準見開き=50、全面問題=100、B問題の(a)(b)は2枚とも問題ページ。
  //  - 解答ページ（answer_x_pct=0）: 見開き丸ごと解答。「解答を見る」まで非表示。
  const bySort = (a: QuestionAsset, b: QuestionAsset) => a.sort - b.sort
  const problemPages = (assets ?? []).filter(a => a.answer_x_pct > 0).sort(bySort)
  const answerPages = (assets ?? []).filter(a => a.answer_x_pct <= 0).sort(bySort)

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
          {!err && problemPages.map((a, i) => (
            urls[a.storage_path]
              ? <div key={`p${i}`} className="rounded-xl overflow-hidden shadow-lg mb-3">
                  <AssetImage
                    url={urls[a.storage_path]}
                    region={a.region}
                    regionYPct={a.region_y_pct ?? 50}
                    answerXPct={a.answer_x_pct}
                    answerYPct={a.answer_y_pct}
                    answerRightYPct={a.answer_right_y_pct ?? 0}
                    showAnswer={showAnswer}
                  />
                </div>
              : null
          ))}
          {/* 見開き丸ごと解答のページ（解答表示時のみ・マスクなし） */}
          {!err && showAnswer && answerPages.map((a, i) => (
            urls[a.storage_path]
              ? <div key={`c${i}`} className="rounded-xl overflow-hidden shadow-lg mb-3">
                  <img src={urls[a.storage_path]} alt="" draggable={false} style={{ width: '100%', display: 'block' }} />
                </div>
              : null
          ))}
        </div>
      </div>

      {/* 記録バー（課題8）。解いた直後にこの画面から理解度を記録して閉じる。
          片手操作のため画面下部に置く。 */}
      {onRecord && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/95 border-t border-gray-100">
          <span className="text-[11px] text-gray-500 shrink-0">理解度</span>
          {(['A', 'B', 'C'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => onRecord(s)}
              title={STATUS_LABEL[s]}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >{s}</button>
          ))}
          <button
            onClick={() => onRecord('S')}
            title={STATUS_LABEL['S']}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-purple-500 border-purple-200 hover:border-purple-400 hover:text-purple-700 transition-colors"
          >S</button>
          {solving && onAbort && (
            <button
              onClick={onAbort}
              title="計測を破棄して閉じます（記録は残りません）"
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              <PauseCircle size={13} /> 中断
            </button>
          )}
        </div>
      )}
    </div>
  )
}
