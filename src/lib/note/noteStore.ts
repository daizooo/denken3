// ノートの保存（端末ローカル・問題ごと）。
//
// 置き場は localStorage で、鍵は問題ID。同じ問題をもう一度開いたら書いた式がそのまま
// 残っている――途中式は「解き直しのときに前回の自分を見る」ために要るので、閉じたら
// 消える作りにはしない。サーバへは送らない（端末内の下書きに徹する。§オフライン方針と同じく、
// 使えない環境ではノートの保存だけを諦め、書く・消すはそのまま動く）。
import { emptyDoc, type NoteDoc, type NoteStroke } from './noteModel'

const KEY_PREFIX = 'denken3:note:'
// 1問あたりの上限。これを超える巨大なノートは保存を諦める（書き味は落とさない）。
// 論理座標は小数4桁に丸めて書き出すので、通常の1問ぶんの筆算なら遠く及ばない。
const MAX_CHARS = 400_000

function keyOf(noteId: string): string {
  return KEY_PREFIX + noteId
}

/** 保存用に座標を小数4桁へ丸める（幅=1基準なので4桁で端末の1px未満）。 */
function round(n: number): number {
  return Math.round(n * 10000) / 10000
}

function serialize(doc: NoteDoc): string {
  const strokes = doc.strokes.map(s => ({
    id: s.id,
    color: s.color,
    width: round(s.width),
    points: s.points.map(pt => (pt.p == null
      ? { x: round(pt.x), y: round(pt.y) }
      : { x: round(pt.x), y: round(pt.y), p: Math.round(pt.p * 100) / 100 })),
  }))
  return JSON.stringify({ v: 1, strokes })
}

/** 壊れた値・別の版が入っていても空ノートとして開く（例外で画面を落とさない）。 */
function parse(raw: string): NoteDoc {
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return emptyDoc()
    const { v, strokes } = obj as { v?: unknown; strokes?: unknown }
    if (v !== 1 || !Array.isArray(strokes)) return emptyDoc()
    const out: NoteStroke[] = []
    for (const s of strokes) {
      if (!s || typeof s !== 'object') continue
      const { id, color, width, points } = s as Partial<NoteStroke>
      if (typeof id !== 'string' || typeof color !== 'string' || typeof width !== 'number') continue
      if (!Array.isArray(points) || points.length === 0) continue
      const pts = points.filter(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number')
      if (pts.length === 0) continue
      out.push({ id, color, width, points: pts })
    }
    return { v: 1, strokes: out }
  } catch {
    return emptyDoc()
  }
}

export function loadNote(noteId: string): NoteDoc {
  try {
    const raw = localStorage.getItem(keyOf(noteId))
    return raw ? parse(raw) : emptyDoc()
  } catch {
    return emptyDoc()
  }
}

/** 保存する。線が無くなったら鍵ごと消す（「ノートあり」の印を残さない）。 */
export function saveNote(noteId: string, doc: NoteDoc): void {
  try {
    if (doc.strokes.length === 0) {
      localStorage.removeItem(keyOf(noteId))
      return
    }
    const body = serialize(doc)
    if (body.length > MAX_CHARS) return
    localStorage.setItem(keyOf(noteId), body)
  } catch { /* 容量超過・プライベートモード等。書き味を止めないため黙って諦める */ }
}

export function clearNote(noteId: string): void {
  try { localStorage.removeItem(keyOf(noteId)) } catch { /* 消せなくても画面上は空になる */ }
}

/** この問題にノートが残っているか（ボタンに印を出すために使う。中身は読まない）。 */
export function hasNote(noteId: string): boolean {
  try {
    return localStorage.getItem(keyOf(noteId)) != null
  } catch {
    return false
  }
}

// パームリジェクト（指・手のひらを無視するか）は端末の持ちもので、問題ごとではない。
// スタイラスを1度でも使った端末では次に開いたときも最初から効いている必要がある
// ――「毎回ペンで一筆書いてから手を置く」では、手を置いて書けるとは言えない。
const PEN_ONLY_KEY = 'denken3:note:pen-only'

export function loadPenOnly(): boolean {
  try {
    return localStorage.getItem(PEN_ONLY_KEY) === '1'
  } catch {
    return false
  }
}

export function savePenOnly(on: boolean): void {
  try { localStorage.setItem(PEN_ONLY_KEY, on ? '1' : '0') } catch { /* 記憶できなくてもその場では効く */ }
}
