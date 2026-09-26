import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Hand, Minus, PenLine, Redo2, Scissors, Trash2, Undo2, X } from 'lucide-react'
import {
  emptyDoc, eraseStroke, hitStroke, translateStroke,
  type NoteDoc, type NoteStroke, type NoteTool,
} from '../../lib/note/noteModel'
import { clearNote, loadNote, loadPenOnly, savePenOnly, saveNote } from '../../lib/note/noteStore'
import NoteCanvas from './NoteCanvas'

// 計算用ノート（白紙）。問題の上にかぶせて開き、途中式・等価回路・ベクトル図を書く。
// 電験の計算問題は紙が無いと解けない一方、タブレットで問題を見ていると紙とペンに
// 持ち替える手間で中断が増える。そこで問題画面から1タップで開き、書いた内容は
// 問題ごとに端末へ残す（解き直しのときに前回の自分の式を見られる）。
//
// 道具立ては GoodNotes に寄せる: ペン（色・太さ）／消しゴム（部分消し）／直線／
// 切り取り（投げ縄）／全削除／戻る・進む。タブレット・スマホではスタイラスで書き、
// 手のひらを画面に置いたまま書ける（パームリジェクト）。

// 論理単位の太さ（描画領域の幅に対する比）。幅820pxなら約2.5/4/7px。
const WIDTHS: { key: string; label: string; value: number }[] = [
  { key: 'thin', label: '細', value: 0.003 },
  { key: 'mid', label: '中', value: 0.005 },
  { key: 'bold', label: '太', value: 0.009 },
]

// 消しゴムの半径（論理単位）。太さの選択をそのまま消しゴムの大きさにも使う
// ――道具ごとに別の大小を覚えさせるより、選んでいる「細・中・太」が効く方が迷わない。
const ERASER_R: Record<string, number> = { thin: 0.012, mid: 0.022, bold: 0.04 }

const COLORS: { key: string; value: string }[] = [
  { key: 'black', value: '#111827' },
  { key: 'red', value: '#dc2626' },
  { key: 'blue', value: '#2563eb' },
]

const TOOLS: { key: NoteTool; label: string; icon: typeof PenLine }[] = [
  { key: 'pen', label: 'ペン', icon: PenLine },
  { key: 'eraser', label: '消しゴム', icon: Eraser },
  { key: 'line', label: '直線', icon: Minus },
  { key: 'lasso', label: '切り取り', icon: Scissors },
]

// 取り消しの深さ。1手ぶんの控えは丸ごとの複製なので、際限なく持たない。
const HISTORY_MAX = 50

// ノートの中身と取り消し履歴は1つの塊で持つ。
// 別々の state に分けると、手のひらの誤入力をペンが引き継ぐ場面のように
// 1度の入力のまとまりの中で「積む→取り消す→書く」が続いたとき、
// どれが先に反映されるかが React のまとめ方次第になり、書いた線が消える。
// 1つにまとめ、遷移をすべて純粋な更新関数にすれば順序は呼んだ順どおりになる。
interface NoteState {
  doc: NoteDoc
  /** 取り消しで戻る先（古い順）。 */
  past: NoteDoc[]
  /** やり直しで進む先（新しい順）。 */
  future: NoteDoc[]
}

function initialState(noteId: string): NoteState {
  return { doc: loadNote(noteId), past: [], future: [] }
}

export default function NoteOverlay({
  noteId, title, onClose,
}: {
  /** ノートの保存単位。問題IDを渡す（問題ごとに別のノートになる）。 */
  noteId: string
  title?: string
  onClose: () => void
}) {
  const [state, setState] = useState<NoteState>(() => initialState(noteId))
  const { doc, past, future } = state
  const [tool, setTool] = useState<NoteTool>('pen')
  const [color, setColor] = useState(COLORS[0].value)
  const [widthKey, setWidthKey] = useState('mid')
  // 手のひらを置いたまま書けるか（指の入力を捨てるか）。端末の持ちものとして覚える
  // ――スタイラスを使う端末では、開いた直後から効いていないと意味がない。
  const [penOnly, setPenOnly] = useState(() => loadPenOnly())
  const [askClear, setAskClear] = useState(false)

  const width = WIDTHS.find(w => w.key === widthKey)?.value ?? WIDTHS[1].value
  const eraserR = ERASER_R[widthKey] ?? ERASER_R.mid

  // 問題が変わったらそのノートを開き直す（履歴も引き継がない）。
  useEffect(() => { setState(initialState(noteId)) }, [noteId])

  // 書いた内容の保存。1本ごとに書き出すと重いので、落ち着いてから保存する。
  // 閉じるとき・問題が変わるときは下の後始末で即書き出す。
  const docRef = useRef(doc)
  docRef.current = doc
  const noteIdRef = useRef(noteId)
  useEffect(() => {
    const iv = setTimeout(() => saveNote(noteId, doc), 400)
    return () => clearTimeout(iv)
  }, [noteId, doc])
  useEffect(() => {
    noteIdRef.current = noteId
    return () => { saveNote(noteIdRef.current, docRef.current) }
  }, [noteId])

  // 1手ぶんの控えを積む。線を増やす・消す・動かす直前に必ず呼ぶ。
  const pushHistory = useCallback(() => {
    setState(s => ({ doc: s.doc, past: [...s.past.slice(-(HISTORY_MAX - 1)), s.doc], future: [] }))
  }, [])

  // 積んだ控えを取り消す（何も起きなかったことにする）。
  // 手のひらで始まった操作をペンが引き継ぐときに使う：手のひらが消した・書いたぶんを
  // その場で戻すので、ユーザーから見れば「手のひらでは何も起きなかった」になる。
  const cancelGesture = useCallback(() => {
    setState(s => (s.past.length === 0
      ? s
      : { doc: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: s.future }))
  }, [])

  const addStroke = useCallback((stroke: NoteStroke) => {
    setState(s => ({ ...s, doc: { v: 1, strokes: [...s.doc.strokes, stroke] } }))
  }, [])

  const removeStrokes = useCallback((ids: string[]) => {
    const drop = new Set(ids)
    setState(s => ({ ...s, doc: { v: 1, strokes: s.doc.strokes.filter(x => !drop.has(x.id)) } }))
  }, [])

  // 部分消し。触れた線を「触れた部分だけ」抜き、残りを断片として置き換える。
  const erasePartial = useCallback((x: number, y: number, r: number) => {
    setState(s => {
      let changed = false
      const out: NoteStroke[] = []
      for (const stroke of s.doc.strokes) {
        // 外接矩形で粗く落としてから切る（線が増えても消しゴムが重くならない）。
        if (!hitStroke(stroke, x, y, r)) { out.push(stroke); continue }
        const frags = eraseStroke(stroke, x, y, r)
        if (frags.length === 1 && frags[0] === stroke) { out.push(stroke); continue }
        changed = true
        out.push(...frags)
      }
      return changed ? { ...s, doc: { v: 1, strokes: out } } : s
    })
  }, [])

  const moveStrokes = useCallback((ids: string[], dx: number, dy: number) => {
    const move = new Set(ids)
    setState(s => ({
      ...s,
      doc: { v: 1, strokes: s.doc.strokes.map(x => (move.has(x.id) ? translateStroke(x, dx, dy) : x)) },
    }))
  }, [])

  const undo = useCallback(() => {
    setState(s => (s.past.length === 0
      ? s
      : {
        doc: s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, HISTORY_MAX),
      }))
  }, [])

  const redo = useCallback(() => {
    setState(s => (s.future.length === 0
      ? s
      : {
        doc: s.future[0],
        past: [...s.past.slice(-(HISTORY_MAX - 1)), s.doc],
        future: s.future.slice(1),
      }))
  }, [])

  const clearAll = () => {
    setState(s => ({ doc: emptyDoc(), past: [...s.past.slice(-(HISTORY_MAX - 1)), s.doc], future: [] }))
    clearNote(noteId)
    setAskClear(false)
  }

  const togglePenOnly = () => {
    setPenOnly(prev => {
      savePenOnly(!prev)
      return !prev
    })
  }

  // スタイラスを見たら手のひら無視を既定にする（以後この端末では最初から効く）。
  const onPenDetected = useCallback(() => {
    setPenOnly(prev => {
      if (prev) return prev
      savePenOnly(true)
      return true
    })
  }, [])

  // PC では Ctrl/Cmd+Z・Shift+Z、Esc で閉じる。
  // ノートを開いている間はビューアのページ送り（←→）を奪わないよう、ここで止める。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, undo, redo])

  return (
    // select-none / touch-none は必須。手のひらや手首が画面に触れたとき、
    // 見出しの文字が範囲選択されたり、画面ごとスクロールしたりして
    // ペンの入力が途切れるのを防ぐ。
    <div
      className="fixed inset-0 z-[60] bg-gray-800 flex flex-col select-none touch-none"
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* 道具立て。片手で届く高さに1段で並べ、幅が足りなければ折り返す。 */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-2 py-1.5 flex items-center gap-1 flex-wrap">
        {/* 戻る・進むは道具より先。書き損じの取り返しが一番よく使う操作で、
            GoodNotes と同じく常に同じ場所（左端）に置く。 */}
        <button
          onClick={undo}
          disabled={past.length === 0}
          title="戻る（Ctrl/⌘+Z）"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
        ><Undo2 size={17} /><span className="hidden sm:inline">戻る</span></button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title="進む（Ctrl/⌘+Shift+Z）"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:text-gray-300"
        ><Redo2 size={17} /><span className="hidden sm:inline">進む</span></button>

        <div className="w-px h-6 bg-gray-200 mx-0.5" />

        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          {TOOLS.map(t => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              title={t.label}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                tool === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            ><t.icon size={15} /><span className="hidden sm:inline">{t.label}</span></button>
          ))}
        </div>

        {/* 色はペンと直線で共通（書くものの見た目は1つに保つ）。 */}
        <div className="flex items-center gap-1 ml-1">
          {COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => setColor(c.value)}
              title="色"
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c.value ? 'border-blue-500 scale-110' : 'border-gray-200'
              }`}
              style={{ background: c.value }}
            />
          ))}
        </div>
        {/* 太さは消しゴムの大きさも兼ねる。 */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          {WIDTHS.map(w => (
            <button
              key={w.key}
              onClick={() => setWidthKey(w.key)}
              title={tool === 'eraser' ? `消しゴムの大きさ：${w.label}` : `太さ：${w.label}`}
              className={`px-2 py-1.5 text-xs font-medium ${
                widthKey === w.key ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >{w.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        {title && <span className="text-[11px] text-gray-400 truncate max-w-[8rem] hidden md:inline">{title}</span>}
        {/* 手のひら無視。スタイラスを持っていない端末では切っておけば指で書ける。 */}
        <button
          onClick={togglePenOnly}
          title={penOnly
            ? 'スタイラスのみ受け付けています（手を置いたまま書けます。指で書くには解除）'
            : '指でも書けます（手のひらの誤入力を防ぐにはON）'}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
            penOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200'
          }`}
        ><Hand size={14} />{penOnly ? 'ペンのみ' : '指OK'}</button>
        <button
          onClick={() => setAskClear(true)}
          disabled={doc.strokes.length === 0}
          title="全削除"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:text-gray-300"
        ><Trash2 size={17} /></button>
        <button onClick={onClose} title="ノートを閉じる" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      {/* 白紙。枠いっぱいに広げる（画面が広いほど書ける面積が増える）。 */}
      <div className="flex-1 min-h-0 p-2">
        <div className="w-full h-full rounded-xl overflow-hidden shadow-lg bg-white">
          <NoteCanvas
            doc={doc}
            tool={tool}
            color={color}
            width={width}
            eraserR={eraserR}
            penOnly={penOnly}
            onGestureStart={pushHistory}
            onGestureCancel={cancelGesture}
            onAddStroke={addStroke}
            onRemoveStrokes={removeStrokes}
            onErasePartial={erasePartial}
            onMoveStrokes={moveStrokes}
            onPenDetected={onPenDetected}
          />
        </div>
      </div>

      {askClear && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setAskClear(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800">このノートを全部消しますか？</p>
            <p className="text-xs text-gray-500">書いた式はすべて消えます（「戻る」で1回だけ戻せます）。</p>
            <div className="flex gap-2">
              <button onClick={() => setAskClear(false)} className="flex-1 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200">戻る</button>
              <button onClick={clearAll} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700">全削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
