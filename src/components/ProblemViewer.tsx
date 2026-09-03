import { useEffect, useState } from 'react'
import { X, Eye, EyeOff, ZoomIn, ZoomOut, PauseCircle } from 'lucide-react'
import { type QuestionAsset, type Region } from '../lib/assets'
import { loadProblemAssets, resolveImageSrc } from '../lib/problemImageCache'
import { STATUS_LABEL } from '../features/shared/status'
import { useViewerZoom } from '../lib/viewerZoom'
import type { Status } from '../domain/types'

// 画像の実寸（見開き1枚）。切り出し・拡大率の計算はすべてこの比率を基準にする。
const IMG_W = 2360
const IMG_H = 1640
// 1ページぶんを描く横幅の上限(px)。広い画面で問題が無制限に巨大化しないための天井で、
// 端末幅がこれより狭ければ端末幅に合わせる（＝スマホ・タブレットは常に画面幅いっぱい）。
const FIT_MAX_PX = 820

// 見開き画像1枚（またはその上/下部分）を、解答マスク付きで表示する。
// マスクは最大2枚:
//  - 右ページ（横 answerXPct% より右・縦 answerRightYPct% より下）を隠す
//    （answerXPct=100 の全面問題ではマスクなし。answerRightYPct>0 は右ページ上部が問題の続きの見開き）
//  - 短い問題（answerYPct<100）は左ページ下部（縦 answerYPct% より下・左ページ内）も隠す
//    ただし解答を隠している間は、白いマスクを見せる代わりにその高さごと切り落とす
//    （拡大表示では空白のスクロールが長くなるだけのため）。
function AssetImage({
  url, region, regionYPct, answerXPct, answerYPct, answerRightYPct, showAnswer,
}: {
  url: string; region: Region; regionYPct: number
  answerXPct: number; answerYPct: number; answerRightYPct: number; showAnswer: boolean
}) {
  // region 指定時は regionYPct を境に上/下だけを見せる（既定は半分）。
  const bandH = region === 'top' ? IMG_H * (regionYPct / 100)
    : region === 'bottom' ? IMG_H * (1 - regionYPct / 100)
      : IMG_H
  // 解答を隠している間だけ、左ページ下部（解答の始まり）を高さごと切り落とす。
  const cropBottom = !showAnswer && answerYPct < 100
  const boxH = cropBottom ? bandH * (answerYPct / 100) : bandH
  // 下バンドは、画像を上バンドの高さぶんだけ上へずらして見せる。
  // top は「箱の高さ」に対する％で解決されるため、切り落とし後の箱の高さで割る。
  const top = region === 'bottom' ? -((IMG_H * (regionYPct / 100)) / boxH) * 100 : 0
  const maskBg = 'rgba(255,255,255,0.98)'
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${IMG_W} / ${boxH}`, overflow: 'hidden', background: '#fff' }}>
      <img
        src={url}
        draggable={false}
        alt=""
        style={{ position: 'absolute', top: `${top}%`, left: 0, width: '100%', display: 'block' }}
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
  // choice は「解答」で選んだ選択肢番号（未選択なら undefined）。
  onRecord?: (status: Status, choice?: number) => void
  // 「問題を解く」で開いた計測を破棄して閉じる（課題13）。育児中の中断は常態で、
  // 中断時間が解答時間に混ざると時間予算の見積もりが狂う。
  onAbort?: () => void
  // 解答時間を計測中か（「問題を解く」で開いたか）。中断ボタンの表示条件。
  solving?: boolean
}) {
  const [assets, setAssets] = useState<QuestionAsset[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showAnswer, setShowAnswer] = useState(false)
  // 解答を見る前に選ぶ自分の答え（課題16）。記録時に履歴へ残す。
  const [choice, setChoice] = useState<number | null>(null)
  const { zoom, zoomIn, zoomOut, canZoomIn, canZoomOut, label: zoomLabel } = useViewerZoom('bunya')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setAssets(null); setUrls({}); setShowAnswer(false); setChoice(null); setErr(null)
    ;(async () => {
      try {
        // 座標も画像URLも Cache Storage 経由で解決する（課題7c）。
        // 先読み済みなら storage_path を鍵にした合成URLが返り、オフラインでも開く。
        const a = await loadProblemAssets(questionId)
        if (!alive) return
        setAssets(a)
        const map: Record<string, string> = {}
        for (const x of a) {
          if (map[x.storage_path]) continue
          // 1枚ごとに失敗を許す。オフラインでは「先読み済みの枚だけ」でも開けた方がよい
          // （未キャッシュの枚は署名URLの発行に失敗する）。
          try {
            map[x.storage_path] = await resolveImageSrc(x.storage_path)
          } catch { /* この1枚は表示しない */ }
        }
        if (!alive) return
        if (a.length > 0 && Object.keys(map).length === 0) {
          setErr('画像を取得できませんでした。オフラインの場合は、電波のあるうちに一度開くと次から表示できます。')
          return
        }
        setUrls(map)
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

  // 端末に自動で合わせる肝（課題16）。見開きのうち実際に読む範囲（左ページ = answer_x_pct%）が
  // 画面幅いっぱいになるよう、画像そのものを 100/answer_x_pct 倍に引き伸ばして描く。
  // 標準の見開き（50）なら2倍＝左ページが画面幅ちょうど。全面問題（100）は等倍。
  // これで「スマホは小さすぎ／タブレットだけ丁度いい」が無くなり、＋を押す必要がなくなる。
  const pageScale = (answerXPct: number) => (answerXPct > 0 && answerXPct < 100 ? 100 / answerXPct : 1)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* トップバー */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white/95 shrink-0">
        <p className="text-sm font-medium text-gray-800 truncate flex-1">{title}</p>
        {/* 自動フィットからの微調整。倍率は端末ごとに記憶する（毎回押し直さない）。 */}
        <button
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          title="縮小"
        ><ZoomOut size={18} /></button>
        <span className="text-[10px] tabular-nums text-gray-400 w-9 text-center">{zoomLabel}</span>
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          title="拡大"
        ><ZoomIn size={18} /></button>
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
        <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: FIT_MAX_PX * zoom }}>
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
          {/* 解答は同じ倍率のまま右ページに続く（縮小して見開き全体を出すと字が読めなくなるため）。
              横スクロールで辿れることは画面から読み取れないので一言だけ出す。 */}
          {!err && showAnswer && problemPages.some(a => a.answer_x_pct < 100) && (
            <p className="text-[11px] text-white/70 mb-2">解答は右ページです（横にスクロール）。</p>
          )}
          {!err && problemPages.map((a, i) => (
            urls[a.storage_path]
              ? <div
                  key={`p${i}`}
                  className="rounded-xl shadow-lg mb-3"
                  // 解答を隠している間は右ページを幅ごと切り落とす（＝左ページが画面幅ちょうど）。
                  // 解答表示中は同じ倍率のまま右へスクロールして読めるようにする。
                  style={{ overflowX: showAnswer ? 'auto' : 'hidden', overflowY: 'hidden' }}
                >
                  <div style={{ width: `${pageScale(a.answer_x_pct) * 100}%` }}>
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

      {/* 解答選択（課題16）。解答を見る前に自分の答えを1つ決める＝本番CBTと同じ手順。
          分野別は正答データを持たないので自動採点はせず、選んだ番号を記録に残して
          解答画像と見比べてから理解度を押す。 */}
      {onRecord && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 border-t border-gray-100">
          <span className="text-[11px] text-gray-500 shrink-0">解答</span>
          {[1, 2, 3, 4, 5].map(v => (
            <button
              key={v}
              onClick={() => setChoice(c => (c === v ? null : v))}
              className={`flex-1 h-9 rounded-lg text-sm font-bold border-2 transition-colors ${
                choice === v
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >{v}</button>
          ))}
        </div>
      )}

      {/* 記録バー（課題8）。解いた直後にこの画面から理解度を記録して閉じる。
          片手操作のため画面下部に置く。 */}
      {onRecord && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/95 border-t border-gray-100">
          <span className="text-[11px] text-gray-500 shrink-0">理解度</span>
          {(['A', 'B', 'C'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => onRecord(s, choice ?? undefined)}
              title={STATUS_LABEL[s]}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >{s}</button>
          ))}
          <button
            onClick={() => onRecord('S', choice ?? undefined)}
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
