// 分野別の解答時間計測（§7.6）。
// 「問題を解く」（ProblemViewer を開く）で計測開始、A/B/C 押下で終了。
// - タブ非表示中は加算しない（visibilitychange で pause/resume）
// - 上限クリップ・日跨ぎは無効（duration_seconds を付けない＝計測前扱い）
//   上限は「その難易度帯の中央値の3倍」と MAX_DURATION_SECONDS の小さいほう（課題13）。
//   30分では中断（画面を消さずに端末を置いた場合は visibilitychange が発火しない）が
//   解答時間として記録され続け、時間予算の見積もり精度を汚染するため引き下げた。
//
// 状態は素朴なプレーンオブジェクトで表現し、App 側で useRef 管理する。純ロジックのみここに置く。

// 難易度帯の中央値が未算出（母数不足）のときに使う既定の上限。
export const MAX_DURATION_SECONDS = 15 * 60

// 記録時の上限秒。中央値の3倍と MAX_DURATION_SECONDS の小さいほうを採る。
// 難易度1（中央値1.9分）なら約5.7分、難易度2（中央値5.3分）なら15分になる。
export function durationCapSeconds(medianSeconds: number | null | undefined): number {
  if (medianSeconds == null || medianSeconds <= 0) return MAX_DURATION_SECONDS
  return Math.min(Math.round(medianSeconds * 3), MAX_DURATION_SECONDS)
}

export interface TimerState {
  day: string               // 開始時点の JST 日付（日跨ぎ判定用）
  accumulatedMs: number     // 表示中に積み上げた経過(ms)
  startedAt: number | null  // 加算中の開始時刻(ms epoch)。非表示中は null
  // 手動で止めているか（画面の「一時停止」）。タブ復帰による自動再開より優先する。
  // これが無いと、止めたまま別アプリへ移って戻った瞬間に visibilitychange が
  // resumeTimer を呼び、意図せず計測が再開する。
  manuallyPaused?: boolean
}

export function startTimer(day: string, now: number = Date.now()): TimerState {
  return { day, accumulatedMs: 0, startedAt: now }
}

// 表示→非表示: 経過を確定し加算中を止める。
export function pauseTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.startedAt == null) return t
  return { ...t, accumulatedMs: t.accumulatedMs + (now - t.startedAt), startedAt: null }
}

// 非表示→表示: 加算を再開する。手動停止中は再開しない（停止の意思を上書きしない）。
export function resumeTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.startedAt != null || t.manuallyPaused) return t
  return { ...t, startedAt: now }
}

// 手動の一時停止／再開。中断（onAbort＝計測を破棄して閉じる）と違い、
// ここまでの経過は残したまま加算だけ止める。育児中の中断は常態で、席を立つたびに
// 計測を捨てていては1問ぶんの解答時間がいつまでも記録できないため（課題13の補完）。
export function setManualPause(
  t: TimerState,
  paused: boolean,
  now: number = Date.now(),
): TimerState {
  if (paused) return { ...pauseTimer(t, now), manuallyPaused: true }
  const resumed: TimerState = { ...t, manuallyPaused: false }
  return resumed.startedAt != null ? resumed : { ...resumed, startedAt: now }
}

// 現在までの経過(ms)。表示用（毎秒読む）。加算が止まっていれば積み上げ分だけを返す。
export function elapsedMs(t: TimerState, now: number = Date.now()): number {
  return t.accumulatedMs + (t.startedAt != null ? now - t.startedAt : 0)
}

// 計測終了時の秒数。無効（日跨ぎ・上限超・0以下）なら undefined を返し、
// 呼び出し側は duration_seconds を付けずに記録する。
export function elapsedSeconds(
  t: TimerState,
  today: string,
  now: number = Date.now(),
  capSeconds: number = MAX_DURATION_SECONDS,
): number | undefined {
  if (t.day !== today) return undefined // 「解答中」のまま日をまたいだら破棄
  const sec = Math.round(elapsedMs(t, now) / 1000)
  if (sec <= 0) return undefined
  if (sec > capSeconds) return undefined // 押し忘れ・中断・放置の外れ値は除外
  return sec
}

// "187" → "3分7秒" / "45" → "45秒"（控えめ表示用）
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}分` : `${m}分${s}秒`
}
