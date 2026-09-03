import { useEffect, useRef, useState } from 'react'
import { X, Eye, EyeOff, ZoomIn, ZoomOut, PauseCircle } from 'lucide-react'
import { type QuestionAsset, type Region } from '../lib/assets'
import { loadProblemAssets, resolveImageSrc } from '../lib/problemImageCache'
import { STATUS_LABEL } from '../features/shared/status'
import { useViewerZoom } from '../lib/viewerZoom'
import AnswerBar from '../features/questions/AnswerBar'
import { emptySelection, type Attempt } from '../lib/attempt'
import type { Status } from '../domain/types'

// 画像の実寸（見開き1枚）。切り出しの計算はこの比率を基準にする。
const IMG_W = 2360
const IMG_H = 1640
// 1ページぶんを描く横幅の上限(px)。広い画面で無制限に巨大化しないための天井で、
// 端末幅がこれより狭ければ端末幅に合わせる（＝スマホ・タブレットは常に画面幅いっぱい）。
const FIT_MAX_PX = 820

// 画像内の切り出し範囲（画像全体に対する%）。表示はすべてこの矩形単位で行う。
interface Rect { x0: number; x1: number; y0: number; y1: number }

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

// 2問同居画像（region top/bottom）の、この問題が使う縦の帯。
// answer_y_pct / answer_right_y_pct はこの帯に対する%で入っている。
function bandOf(a: QuestionAsset): { start: number; span: number } {
  const ry = a.region_y_pct ?? 50
  const region: Region = a.region
  if (region === 'top') return { start: 0, span: ry }
  if (region === 'bottom') return { start: ry, span: 100 - ry }
  return { start: 0, span: 100 }
}

// 問題として見せる範囲。1枚の見開きから最大2つ出る:
//  - 左ページ（短い問題なら answer_y_pct まで）
//  - 右ページ上部（answer_right_y_pct>0 ＝ 小問(b)や選択肢が右ページ上部へ続く見開き）
// 丸ごと解答のページ（answer_x_pct<=0）は問題側に無い。
function problemRects(a: QuestionAsset): Rect[] {
  if (a.answer_x_pct <= 0) return []
  const b = bandOf(a)
  const out: Rect[] = [{
    x0: 0, x1: a.answer_x_pct,
    y0: b.start, y1: b.start + b.span * (a.answer_y_pct / 100),
  }]
  const rightTop = a.answer_right_y_pct ?? 0
  if (a.answer_x_pct < 100 && rightTop > 0) {
    out.push({ x0: a.answer_x_pct, x1: 100, y0: b.start, y1: b.start + b.span * (rightTop / 100) })
  }
  return out
}

// 解答として見せる範囲。1枚の見開きから最大2つ出る:
//  - 左ページ下部（短い問題で解答が下に始まる場合・answer_y_pct<100）
//  - 右ページ（標準の見開き・answer_right_y_pct から下）
// 全面問題（answer_x_pct=100 かつ answer_y_pct=100）はこの画像に解答が無く、
// 続きの「丸ごと解答ページ」が受け持つ。
function answerRects(a: QuestionAsset): Rect[] {
  const b = bandOf(a)
  const end = b.start + b.span
  if (a.answer_x_pct <= 0) return [{ x0: 0, x1: 100, y0: b.start, y1: end }]
  const out: Rect[] = []
  if (a.answer_y_pct < 100) {
    out.push({ x0: 0, x1: a.answer_x_pct, y0: b.start + b.span * (a.answer_y_pct / 100), y1: end })
  }
  if (a.answer_x_pct < 100) {
    out.push({ x0: a.answer_x_pct, x1: 100, y0: b.start + b.span * ((a.answer_right_y_pct ?? 0) / 100), y1: end })
  }
  return out
}

export default function ProblemViewer({
  questionId, title, onClose, onRecord, onGiveUp, onAbort, solving = false, partCount = 1,
}: {
  questionId: string
  title: string
  onClose: () => void
  // 理解度をこの画面から直接記録する（課題8）。押したらそのまま閉じる。
  // 解答前コミット（Phase 1）で選んだ選択肢を attempt として一緒に渡す。
  onRecord?: (status: Status, attempt?: Attempt) => void
  // 「わからない」: 理解度 C を即時記録するが、画面は閉じない（解答を読ませるため）。
  onGiveUp?: (attempt: Attempt) => void
  // 「問題を解く」で開いた計測を破棄して閉じる（課題13）。育児中の中断は常態で、
  // 中断時間が解答時間に混ざると時間予算の見積もりが狂う。
  onAbort?: () => void
  // 解答時間を計測中か（「問題を解く」で開いたか）。中断ボタンの表示条件であり、
  // 解答前コミット（Phase 1）を要求するかの条件でもある。
  // 「問題を見る」（確認のみ）はゲートせず、従来どおり自由に解答を開ける。
  solving?: boolean
  // 小問数。B問題は 2（(a)(b)）。sourceLink.partCountFromTitle で導く。
  partCount?: 1 | 2
}) {
  const [assets, setAssets] = useState<QuestionAsset[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showAnswer, setShowAnswer] = useState(false)
  // 解答前コミット（設計 §2.1）。選んだ選択肢と、「わからない」で記録済みかどうか。
  const [selected, setSelected] = useState<number[]>(() => emptySelection(partCount))
  const [gaveUp, setGaveUp] = useState(false)
  const { zoom, zoomIn, zoomOut, canZoomIn, canZoomOut, label: zoomLabel } = useViewerZoom('bunya')
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 問題⇄解答を切り替えたら先頭から見せる（前の位置に留まると、切り替えたのに
  // 画面が変わっていないように見える）。
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, left: 0 }) }, [showAnswer, questionId])

  useEffect(() => {
    let alive = true
    setAssets(null); setUrls({}); setShowAnswer(false); setErr(null)
    setSelected(emptySelection(partCount)); setGaveUp(false)
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
  }, [questionId, partCount])

  // 表示は sort ではなく answer_x_pct（マスク位置）で振り分ける:
  //  - 問題ページ（answer_x_pct>0）: 左ページ（と、短い問題ならその上部）が問題、残りが解答。
  //  - 解答ページ（answer_x_pct=0）: 見開き丸ごと解答。解答表示に切り替えるまで出さない。
  const bySort = (a: QuestionAsset, b: QuestionAsset) => a.sort - b.sort
  const sorted = (assets ?? []).slice().sort(bySort)

  // 問題／解答の切り替えは、同じ画像の「どの範囲を画面幅で描くか」を差し替えるだけ。
  // スクロールで探しにいく必要がないので、ボタン1つで瞬時に入れ替わる（課題16-2）。
  const panes: { path: string; rect: Rect }[] = showAnswer
    ? sorted.flatMap(a => answerRects(a).map(rect => ({ path: a.storage_path, rect })))
    : sorted.flatMap(a => problemRects(a).map(rect => ({ path: a.storage_path, rect })))

  const visible = panes.filter(p => urls[p.path])

  // 解答前コミットを要求するか（設計 §2.1）。
  // 「問題を解く」で開いたときだけゲートする。「問題を見る」（確認のみ・計測なし）は
  // 従来どおり自由に解答を開ける ―― 眺めるための導線を潰すと確認の用途が失われるため。
  const gated = solving && !!onRecord

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
        {/* 解答前コミット中（gated）は、解答を開く導線を下部の AnswerBar 側へ一本化する。
            解答表示後は「問題に戻る」として使えるよう残す（図を見直せるように）。 */}
        {(!gated || showAnswer) && (
          <button
            onClick={() => setShowAnswer(s => !s)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
              showAnswer
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-blue-600 text-white border-blue-600'
            }`}
          >
            {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAnswer ? '問題に戻る' : '解答を見る'}
          </button>
        )}
        <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="閉じる">
          <X size={18} />
        </button>
      </div>

      {/* 本体 */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3">
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
          {!err && assets !== null && assets.length > 0 && visible.length === 0 && (
            <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
              {showAnswer ? '解答の画像が登録されていません。' : '問題の画像が登録されていません。'}
            </div>
          )}
          {!err && visible.map((p, i) => (
            <div key={`${showAnswer ? 'a' : 'q'}${i}`} className="rounded-xl overflow-hidden shadow-lg mb-3">
              <CropImage url={urls[p.path]} rect={p.rect} />
            </div>
          ))}
        </div>
      </div>

      {/* 解答前コミットのバー（Phase 1・設計 §2.1）。
          選択肢を確定するか「わからない」を通すまで、解答を開けない。 */}
      {gated && !showAnswer && (
        <AnswerBar
          partCount={partCount}
          selected={selected}
          onSelect={(pi, v) => setSelected(prev => prev.map((x, i) => (i === pi ? v : x)))}
          onReveal={() => setShowAnswer(true)}
          onGiveUp={() => {
            setGaveUp(true)
            setShowAnswer(true)
            // 記録はここで確定させるが、画面は閉じない（解答・解説を読ませるため）。
            onGiveUp?.({ selected, gaveUp: true })
          }}
        />
      )}

      {/* 「わからない」で記録済みのときは、理解度を二重に記録させない。 */}
      {gaveUp && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/95 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            理解度 <b className="text-red-500">C</b>（答えを見た）で記録しました
          </span>
          <button
            onClick={onClose}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >閉じる</button>
        </div>
      )}

      {/* 記録バー（課題8）。解いた直後にこの画面から理解度を記録して閉じる。
          片手操作のため画面下部に置く。
          ゲート中は解答を見るまで出さない（先に選択肢を確定させるため）。 */}
      {onRecord && !gaveUp && (!gated || showAnswer) && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/95 border-t border-gray-100">
          <span className="text-[11px] text-gray-500 shrink-0">理解度</span>
          {(['A', 'B', 'C'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => onRecord(s, { selected })}
              title={STATUS_LABEL[s]}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >{s}</button>
          ))}
          <button
            onClick={() => onRecord('S', { selected })}
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
