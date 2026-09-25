import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PauseCircle } from 'lucide-react'
import { type QuestionAsset } from '../lib/assets'
import { panesOf, type Rect } from '../lib/viewerPages'
import { loadProblemAssets, resolveImageSrc } from '../lib/problemImageCache'
import { STATUS_LABEL } from '../features/shared/status'
import { useViewerZoom } from '../lib/viewerZoom'
import SolveTimerBar from '../features/questions/SolveTimerBar'
import { playAlarm } from '../lib/alarm'
import type { Status } from '../domain/types'

// 画像の実寸（見開き1枚）。切り出しの計算はこの比率を基準にする。
const IMG_W = 2360
const IMG_H = 1640
// 1ページぶんを描く横幅の上限(px)。広い画面で無制限に巨大化しないための天井で、
// 端末幅がこれより狭ければ端末幅に合わせる（＝スマホ・タブレットは常に画面幅いっぱい）。
const FIT_MAX_PX = 820

// 矩形1つを、外枠の幅いっぱいに引き伸ばして描く（課題16）。
// 見開きの左ページだけ・右ページだけ、といった範囲が常に画面幅ちょうどになるため、
// 端末が変わっても縮尺が合う。切り出しは画像を動かして枠で隠すだけで、加工はしない。
function CropImage({ url, rect }: { url: string; rect: Rect }) {
  const w = rect.x1 - rect.x0
  const h = rect.y1 - rect.y0
  return (
    <div
      style={{
        position: 'relative', width: '100%', overflow: 'hidden',
        aspectRatio: `${IMG_W * w} / ${IMG_H * h}`, background: '#fff',
      }}
    >
      <img
        src={url}
        draggable={false}
        alt=""
        style={{
          position: 'absolute', display: 'block',
          // 幅・位置はいずれも外枠に対する%。切り出し幅 w% が枠いっぱいになる倍率で描き、
          // 左上が (x0,y0) に来るようにずらす。
          // maxWidth: 'none' は必須。Tailwind の preflight が img に max-width:100% を当てており、
          // これが無いと 100% を超える拡大が枠幅で頭打ちになり、切り出しが効かず画像全体が出る。
          maxWidth: 'none',
          width: `${(100 / w) * 100}%`,
          left: `${-(rect.x0 / w) * 100}%`,
          top: `${-(rect.y0 / h) * 100}%`,
        }}
      />
    </div>
  )
}

export default function ProblemViewer({
  questionId, title, onClose, onRecord, onAbort, solving = false,
  cutoffSec, getElapsedMs, onPauseChange,
}: {
  questionId: string
  title: string
  onClose: () => void
  // 理解度をこの画面から直接記録する（課題8）。押したらそのまま閉じる。
  onRecord?: (status: Status) => void
  // 「問題を解く」で開いた計測を破棄して閉じる（課題13）。育児中の中断は常態で、
  // 中断時間が解答時間に混ざると時間予算の見積もりが狂う。
  onAbort?: () => void
  // 解答時間を計測中か（「問題を解く」で開いたか）。中断ボタン・経過時間の表示条件。
  solving?: boolean
  // 切り上げ時間（秒・solveTimer.cutoffSeconds）。ここを過ぎたらアラームを鳴らす。
  cutoffSec?: number
  // 計測の経過(ms)を読む。実体は App 側の ref なので、毎秒ここから読み直す。
  getElapsedMs?: (questionId: string) => number
  // 一時停止の切り替えを App の計測状態へ伝える。
  onPauseChange?: (questionId: string, paused: boolean) => void
}) {
  const [assets, setAssets] = useState<QuestionAsset[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showAnswer, setShowAnswer] = useState(false)
  // 何ページ目を見ているか。問題／解答・問題の切り替えで先頭に戻す。
  const [page, setPage] = useState(0)
  const { zoom, zoomIn, zoomOut, canZoomIn, canZoomOut, label: zoomLabel } = useViewerZoom('bunya')
  const [err, setErr] = useState<string | null>(null)
  // ページを横に連結したストリップ（実体は横スクロール＋スナップ）。フリックで送る。
  const stripRef = useRef<HTMLDivElement>(null)
  // 経過時間の表示（§7.6 の計測を可視化する）。値の実体は App 側の ref なので、
  // ここでは毎秒読み直すだけ。計測そのものはこの state に依存しない。
  const [elapsedSec, setElapsedSec] = useState(0)
  const [paused, setPaused] = useState(false)
  // 切り上げアラームは1問につき1回だけ鳴らす。
  const alarmedRef = useRef(false)

  // 経過時間と切り上げアラームを出すのは「問題を解く」で開いたときだけ。
  const cutoff = cutoffSec ?? 0
  const timed = solving && cutoff > 0 && getElapsedMs != null
  const overdue = timed && elapsedSec >= cutoff

  // 問題が変わったら計測表示と停止状態をやり直す。
  // 下の毎秒タイマーより先に置く（後ろに置くと、切り替え直後に読み直した値を 0 で潰す）。
  useEffect(() => { setElapsedSec(0); setPaused(false); alarmedRef.current = false }, [questionId])

  // 1秒ごとに経過を読み直す。一時停止・タブ非表示のときは値が進まないので、
  // ここで分岐する必要はない（止めるのは計測側の責務）。
  useEffect(() => {
    if (!solving || !getElapsedMs) return
    const read = getElapsedMs
    const tick = () => setElapsedSec(Math.floor(read(questionId) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [solving, getElapsedMs, questionId])

  // 切り上げ時間の到達で鳴らす（1問につき1回）。解答を開いたあとは鳴らさない
  // ――「解答を見よう」と促すのがアラームの目的なので、見たあとには用が無い。
  useEffect(() => {
    if (!timed || alarmedRef.current || showAnswer || paused) return
    if (elapsedSec < cutoff) return
    alarmedRef.current = true
    playAlarm()
  }, [timed, cutoff, elapsedSec, showAnswer, paused])

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    onPauseChange?.(questionId, next)
  }

  useEffect(() => {
    let alive = true
    setAssets(null); setUrls({}); setShowAnswer(false); setErr(null)
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
  //  - 問題ページ（answer_x_pct>0）: 左ページ（と、短い問題ならその上部）が問題、残りが解答。
  //  - 解答ページ（answer_x_pct=0）: 見開き丸ごと解答。解答表示に切り替えるまで出さない。
  // 得られた範囲は綴じ目で割り、1ページ＝1枚に揃える。
  const panes = useMemo(() => panesOf(assets ?? [], showAnswer), [assets, showAnswer])

  const visible = panes.filter(p => urls[p.path])
  const pageCount = visible.length
  // 画像の読み込みやページ数の変化で範囲外にならないよう、表示のたびに丸める。
  const cur = Math.min(page, Math.max(0, pageCount - 1))

  // 問題・問題／解答を切り替えたら1ページ目へ戻す。
  // ストリップ自体は key で作り直すため、スクロール位置（横・縦とも）は自動で先頭に戻る。
  useEffect(() => { setPage(0) }, [showAnswer, questionId])

  // フリックで動いた横位置から「今どのページか」を読む。ページ番号の表示はこれが唯一の源。
  const onStripScroll = () => {
    const el = stripRef.current
    if (!el || el.clientWidth === 0) return
    const i = Math.max(0, Math.min(pageCount - 1, Math.round(el.scrollLeft / el.clientWidth)))
    setPage(prev => (prev === i ? prev : i))
  }

  // 矢印ボタン・キーボードからのページ送り。動かすのはストリップの横位置で、
  // ページ番号は上の onStripScroll が追随して更新する（状態の持ち主を1つにする）。
  const goPage = useCallback((dir: 1 | -1) => {
    const el = stripRef.current
    if (!el) return
    setPage(prev => {
      const from = Math.max(0, Math.min(pageCount - 1, prev))
      const next = Math.max(0, Math.min(pageCount - 1, from + dir))
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
      return next
    })
  }, [pageCount])

  // PC ではキーボードの左右でもページを送る。
  useEffect(() => {
    if (pageCount < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goPage(1)
      else if (e.key === 'ArrowLeft') goPage(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageCount, goPage])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* トップバー: 問題⇄解答の切り替えを主役に置く（何度も行き来するため）。 */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white/95 shrink-0">
        <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{title}</p>
        {/* 問題／解答スイッチ。今どちらを見ているかが一目で分かる2択にする。 */}
        <div className="flex shrink-0 rounded-lg border-2 border-blue-600 overflow-hidden">
          {([false, true] as const).map(ans => (
            <button
              key={String(ans)}
              onClick={() => setShowAnswer(ans)}
              className={`px-3 py-1 text-xs font-bold transition-colors ${
                showAnswer === ans ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
              }`}
            >{ans ? '解答' : '問題'}</button>
          ))}
        </div>
        {/* 自動フィットからの微調整。倍率は端末ごとに記憶する（毎回押し直さない）。 */}
        <button
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          title="縮小"
        ><ZoomOut size={18} /></button>
        <span className="text-[10px] tabular-nums text-gray-400 w-8 text-center">{zoomLabel}</span>
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
          title="拡大"
        ><ZoomIn size={18} /></button>
        <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="閉じる">
          <X size={18} />
        </button>
      </div>

      {/* 本体。ページを横に連結し、フリック（横スワイプ）で送る。
          1ページ＝画面幅いっぱいなので、どの端末でも縮尺が変わらない。 */}
      <div className="relative flex-1 min-h-0">
        {pageCount > 0 ? (
          <div
            // 問題・問題／解答が変わったら作り直す（横位置・縦位置とも先頭に戻す）。
            key={`${questionId}:${showAnswer ? 'a' : 'q'}`}
            ref={stripRef}
            onScroll={onStripScroll}
            className="h-full flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visible.map((p, i) => (
              // 1ページ＝1枠。枠ごとに縦スクロールを持たせ、横フリックと干渉させない。
              <div key={i} className="w-full h-full shrink-0 snap-start snap-always overflow-auto p-3">
                <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: FIT_MAX_PX * zoom }}>
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <CropImage url={urls[p.path]} rect={p.rect} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full overflow-auto p-3">
            <div className="mx-auto" style={{ maxWidth: FIT_MAX_PX }}>
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
              {!err && assets !== null && assets.length > 0 && (
                <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
                  {showAnswer ? '解答の画像が登録されていません。' : '問題の画像が登録されていません。'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ページ送り。画像の上に常に浮かせる（スクロールしても隠れない位置に固定する）。
            フリックでも送れるが、それに気づかなくても操作できるよう矢印を必ず出す。 */}
        {pageCount > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 pointer-events-none">
            {cur === 0 && (
              <span className="rounded-full bg-black/55 text-white text-[10px] font-medium px-2.5 py-1">
                横スワイプでページ送り
              </span>
            )}
            <div className="pointer-events-auto flex items-center rounded-full bg-white/95 shadow-lg border border-gray-200 p-1">
              <button
                onClick={() => goPage(-1)}
                disabled={cur === 0}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
                title="前のページ"
              ><ChevronLeft size={20} /></button>
              <span className="text-xs font-bold tabular-nums text-gray-700 w-12 text-center">
                {cur + 1} / {pageCount}
              </span>
              <button
                onClick={() => goPage(1)}
                disabled={cur === pageCount - 1}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
                title="次のページ"
              ><ChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </div>

      {/* 下のバー: 時間計測（「問題を解く」で開いたときだけ）と理解度。 */}
      {timed && (
        <SolveTimerBar
          elapsedSec={elapsedSec}
          cutoffSec={cutoff}
          paused={paused}
          overdue={overdue}
          onTogglePause={togglePause}
        />
      )}

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
