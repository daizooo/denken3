// 本番の持ち時間（examTime.ts）が、試験時間から逆算した値と食い違っていないことを固定する。

import { describe, it, expect } from 'vitest'
import { SENTAKU_BLANK_LIMIT_SECONDS, TAKU_ITEM_LIMIT_SECONDS, examTimeLimitSeconds } from './examTime'

describe('本番の持ち時間', () => {
  it('択一の肢と選択式の空欄で値が分かれる。読めないIDは択一の肢として扱う', () => {
    expect(examTimeLimitSeconds('R08_T_RK_03_C')).toBe(TAKU_ITEM_LIMIT_SECONDS)
    expect(examTimeLimitSeconds('R08_S_RK_A')).toBe(SENTAKU_BLANK_LIMIT_SECONDS)
    expect(examTimeLimitSeconds('q1')).toBe(TAKU_ITEM_LIMIT_SECONDS)
  })

  it('全問を持ち時間いっぱいで解いても、試験時間（見直し1割を残す）に収まる', () => {
    // 択一式: 210分・70問×5肢 / 選択式: 80分・40空欄
    expect(TAKU_ITEM_LIMIT_SECONDS * 70 * 5).toBeLessThanOrEqual(210 * 60 * 0.9)
    expect(SENTAKU_BLANK_LIMIT_SECONDS * 40).toBeLessThanOrEqual(80 * 60 * 0.9)
  })
})
