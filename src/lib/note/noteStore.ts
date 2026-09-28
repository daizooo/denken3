// ノートまわりで端末に覚えておく設定。
//
// 書いた内容そのものは保存しない。ノートは「その問題を解いている間の計算用紙」で、
// 問題を閉じたら白紙に戻る（前回の書き込みが残っていると、次に解くときに答えが見えてしまう）。
// 中身はメモリにだけ持ち、ここで扱うのは道具の設定だけにする。

// パームリジェクト（指・手のひらを無視するか）は端末の持ちもので、問題ごとではない。
// スタイラスを1度でも使った端末では、次に開いたときも最初から効いている必要がある
// ――「毎回ペンで一筆書いてから手を置く」では、手を置いて書けるとは言えない。
const PEN_ONLY_KEY = 'denken3:note:pen-only'

// 以前の版が問題ごとに書き込んでいた鍵の接頭辞（設定の鍵と区別するため個別に判定する）。
const LEGACY_PREFIX = 'denken3:note:'

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

/**
 * 以前の版が端末に残した「問題ごとのノート」を消す。
 * 保存をやめた以上、古い書き込みが端末に残り続ける理由はない（容量も食う）。
 */
export function purgeSavedNotes(): void {
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key !== PEN_ONLY_KEY && key.startsWith(LEGACY_PREFIX)) stale.push(key)
    }
    for (const key of stale) localStorage.removeItem(key)
  } catch { /* 消せなくても動作には影響しない */ }
}
