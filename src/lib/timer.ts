// 分野別の解答時間計測（§7.6）。
// 「問題を見る」（ProblemViewer を開く）で計測開始、A/B/C 押下で終了。
// - タブ非表示中は加算しない（visibilitychange で pause/resume）
// - 上限クリップ 30分・日跨ぎは無効（duration_seconds を付けない＝計測前扱い）
//
// 状態は素朴なプレーンオブジェクトで表現し、App 側で useRef 管理する。純ロジックのみここに置く。

export const MAX_DURATION_SECONDS = 30 * 60

export interface TimerState {
  day: string               // 開始時点の JST 日付（日跨ぎ判定用）
  accumulatedMs: number     // 表示中に積み上げた経過(ms)
  startedAt: number | null  // 加算中の開始時刻(ms epoch)。非表示中は null
}

export function startTimer(day: string, now: number = Date.now()): TimerState {
  return { day, accumulatedMs: 0, startedAt: now }
}

// 表示→非表示: 経過を確定し加算中を止める。
export function pauseTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.startedAt == null) return t
  return { ...t, accumulatedMs: t.accumulatedMs + (now - t.startedAt), startedAt: null }
}

// 非表示→表示: 加算を再開する。
export function resumeTimer(t: TimerState, now: number = Date.now()): TimerState {
  if (t.startedAt != null) return t
  return { ...t, startedAt: now }
}

// 計測終了時の秒数。無効（日跨ぎ・30分超・0以下）なら undefined を返し、
// 呼び出し側は duration_seconds を付けずに記録する。
export function elapsedSeconds(
  t: TimerState,
  today: string,
  now: number = Date.now(),
): number | undefined {
  if (t.day !== today) return undefined // 「解答中」のまま日をまたいだら破棄
  const totalMs = t.accumulatedMs + (t.startedAt != null ? now - t.startedAt : 0)
  const sec = Math.round(totalMs / 1000)
  if (sec <= 0) return undefined
  if (sec > MAX_DURATION_SECONDS) return undefined // 押し忘れ・放置の外れ値は除外
  return sec
}

// "187" → "3分7秒" / "45" → "45秒"（控えめ表示用）
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}分` : `${m}分${s}秒`
}
