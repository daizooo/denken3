import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Hand, Minus, PenLine, Redo2, Scissors, Trash2, Undo2, X } from 'lucide-react'
import { emptyDoc, translateStroke, type NoteDoc, type NoteStroke, type NoteTool } from '../../lib/note/noteModel'
import { clearNote, loadNote, saveNote } from '../../lib/note/noteStore'
import NoteCanvas from './NoteCanvas'

// 計算用ノート（白紙）。問題の上にかぶせて開き、途中式・等価回路・ベクトル図を書く。
// 電験の計算問題は紙が無いと解けない一方、タブレットで問題を見ていると紙とペンに
// 持ち替える手間で中断が増える。そこで問題画面から1タップで開き、書いた内容は
// 問題ごとに端末へ残す（解き直しのときに前回の自分の式を見られる）。
//
// 道具立ては GoodNotes に寄せる: ペン（色・太さ）／消しゴム／直線／切り取り（投げ縄）／全削除。
// タブレット・スマホではスタイラスで書く。スタイラスを1度でも検知したら、
// 既定で指と手のひらの入力を無視する（手を置いたまま書ける）。

// 論理単位の太さ（描画領域の幅に対する比）。幅820pxなら約2.5/4/7px。
const WIDTHS: { key: string; label: string; value: number }[] = [
  { key: 'thin', label: '細', value: 0.003 },
  { key: 'mid', label: '中', value: 0.005 },
  { key: 'bold', label: '太', value: 0.009 },
]

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

export default function NoteOverlay({
  noteId, title, onClose,
}: {
  /** ノートの保存単位。問題IDを渡す（問題ごとに別のノートになる）。 */
  noteId: string
  title?: string
  onClose: () => void
}) {
  const [doc, setDoc] = useState<NoteDoc>(() => loadNote(noteId))
  const [past, setPast] = useState<NoteDoc[]>([])
  const [future, setFuture] = useState<NoteDoc[]>([])
  const [tool, setTool] = useState<NoteTool>('pen')
  const [color, setColor] = useState(COLORS[0].value)
  const [width, setWidth] = useState(WIDTHS[1].value)
  // スタイラスを検知したら指・手のひらを無視する（手を置いて書けるように）。
  // 検知前は指でも書ける（スタイラスを持っていない端末で書けなくなるのを避ける）。
  const [penSeen, setPenSeen] = useState(false)
  const [penOnly, setPenOnly] = useState(false)
  const [askClear, setAskClear] = useState(false)

  // 問題が変わったらそのノートを開き直す（履歴も引き継がない）。
  useEffect(() => {
    setDoc(loadNote(noteId))
    setPast([])
    setFuture([])
  }, [noteId])

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
    setPast(prev => [...prev.slice(-(HISTORY_MAX - 1)), docRef.current])
    setFuture([])
  }, [])

  const addStroke = useCallback((stroke: NoteStroke) => {
    setDoc(prev => ({ v: 1, strokes: [...prev.strokes, stroke] }))
  }, [])

  const removeStrokes = useCallback((ids: string[]) => {
    const drop = new Set(ids)
    setDoc(prev => ({ v: 1, strokes: prev.strokes.filter(s => !drop.has(s.id)) }))
  }, [])

  const moveStrokes = useCallback((ids: string[], dx: number, dy: number) => {
    const move = new Set(ids)
    setDoc(prev => ({
      v: 1,
      strokes: prev.strokes.map(s => (move.has(s.id) ? translateStroke(s, dx, dy) : s)),
    }))
  }, [])

  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setFuture(f => [docRef.current, ...f].slice(0, HISTORY_MAX))
      setDoc(last)
      return prev.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev
      setPast(p => [...p.slice(-(HISTORY_MAX - 1)), docRef.current])
      setDoc(prev[0])
      return prev.slice(1)
    })
  }, [])

  const clearAll = () => {
    pushHistory()
    setDoc(emptyDoc())
    clearNote(noteId)
    setAskClear(false)
  }

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

  const onPenDetected = useCallback(() => {
    setPenSeen(prev => {
      if (prev) return prev
      setPenOnly(true)
      return true
    })
  }, [])

  return (
    <div className="fixed inset-0 z-[60] bg-gray-800 flex flex-col">
      {/* 道具立て。片手で届く高さに1段で並べ、幅が足りなければ折り返す。 */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-2 py-1.5 flex items-center gap-1 flex-wrap">
        <span className="text-xs font-bold text-gray-700 mr-1">ノート</span>
        {title && <span className="text-[11px] text-gray-400 truncate max-w-[10rem] hidden sm:inline">{title}</span>}

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

        {/* 色・太さはペンと直線で共通（書くものの見た目は1つに保つ）。 */}
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
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          {WIDTHS.map(w => (
            <button
              key={w.key}
              onClick={() => setWidth(w.value)}
              title={`太さ：${w.label}`}
              className={`px-2 py-1.5 text-xs font-medium ${
                width === w.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >{w.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        <button
          onClick={undo}
          disabled={past.length === 0}
          title="取り消し"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
        ><Undo2 size={17} /></button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title="やり直し"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:text-gray-300"
        ><Redo2 size={17} /></button>
        {/* スタイラスを検知した端末だけに出す（無い端末に無意味な切り替えを見せない）。 */}
        {penSeen && (
          <button
            onClick={() => setPenOnly(v => !v)}
            title={penOnly ? 'スタイラスのみ受け付けています（指で書くには解除）' : '指でも書けます（手のひら誤入力を防ぐにはON）'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
              penOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200'
            }`}
          ><Hand size={14} />{penOnly ? 'ペンのみ' : '指OK'}</button>
        )}
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
            penOnly={penOnly}
            onGestureStart={pushHistory}
            onAddStroke={addStroke}
            onRemoveStrokes={removeStrokes}
            onMoveStrokes={moveStrokes}
            onPenDetected={onPenDetected}
          />
        </div>
      </div>

      {askClear && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setAskClear(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800">このノートを全部消しますか？</p>
            <p className="text-xs text-gray-500">書いた式はすべて消えます（取り消しで1回だけ戻せます）。</p>
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
