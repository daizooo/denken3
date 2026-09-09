// 切り上げ時間のアラーム音。
//
// 音源ファイルは持たず WebAudio で短いビープを合成する。理由は2つ:
//  - このアプリはオフライン前提（課題7）。音声ファイルは Service Worker のキャッシュ対象を
//    増やすが、合成なら取得が発生しない。
//  - リポジトリにバイナリを足さずに済む。
//
// iOS Safari は「ユーザー操作の中で作られ、resume された AudioContext」でなければ
// 音を出さない。そのため prime() を「問題を解く」のタップ経路で呼び、
// 実際に鳴らすのはそのあとのタイマー発火（＝操作外）にする。
//
// 音が出せない環境（許可なし・消音）でも気づけるよう、振動もあわせて試みる。

type AudioContextCtor = typeof AudioContext

let ctx: AudioContext | null = null

function ctor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

// 使い回す AudioContext を用意して返す（作れない環境では null）。
// 一度きりの生成にするのは、鳴らすたびに作ると端末の同時オープン数の上限に当たるため。
function ensureContext(): AudioContext | null {
  const C = ctor()
  if (!C) return null
  const ac = ctx ?? new C()
  ctx = ac
  // 自動再生制限で停止していることがある。ユーザー操作の中なら resume が通る。
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

// ユーザー操作の中で呼ぶ。ここで AudioContext を用意しておかないと、
// あとからタイマーで鳴らそうとしても iOS では無音になる。
export function primeAlarm(): void {
  try {
    ensureContext()
  } catch { /* 音が出せなくても学習は続けられる。握りつぶす */ }
}

// 短いビープを3回。耳障りにならない程度の音量（0.15）に留める。
export function playAlarm(): void {
  try {
    navigator.vibrate?.([180, 120, 180, 120, 180])
  } catch { /* 非対応端末 */ }
  try {
    const ac = ensureContext()
    if (!ac) return
    const t0 = ac.currentTime
    for (let i = 0; i < 3; i++) {
      const start = t0 + i * 0.28
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      // 立ち上がり・立ち下がりを付ける。矩形に切るとプチッというクリック音が入る。
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(ac.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    }
  } catch { /* 同上 */ }
}
