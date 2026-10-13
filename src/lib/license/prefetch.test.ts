// 起動時の先取り対象（licensehub-expansion.md §5）。
import { describe, expect, it } from 'vitest'
import { prefetchTargets } from './prefetch'
import { defaultReview } from '../fsrs'
import type { Review } from '../../domain/types'

const TODAY = '2026-10-13'
const rev = (id: string, due: string | null, status: Review['status'] = 'B'): Review => ({
  ...defaultReview(id), status, due_date: due,
  review_history: status === '未着手' ? [] : [{ date: '2026-10-01', status }],
})

describe('prefetchTargets', () => {
  it('今日〜14日先（期限切れを含む）の復習対象を期限順に含め、15日先以降は含めない', () => {
    const reviews = Object.fromEntries([
      rev('R07_T_RK_01_A', '2026-10-20'),
      rev('R07_T_RK_01_B', '2026-10-01'),
      rev('R07_T_RK_01_C', '2026-10-27'),
      rev('R07_T_RK_01_D', '2026-10-28'),
      rev('R07_T_RK_01_E', null),
    ].map(r => [r.question_id, r]))
    expect(prefetchTargets(reviews, [], TODAY)).toEqual(['R07_T_RK_01_B', 'R07_T_RK_01_A', 'R07_T_RK_01_C'])
  })
  it('学習科目の未着手は先頭から上限件数まで。着手済みは除く', () => {
    const ids = ['R07_T_RK_02_A', 'R07_T_RK_02_B', 'R07_T_RK_02_C', 'R07_T_RK_02_D']
    const reviews = { R07_T_RK_02_B: rev('R07_T_RK_02_B', '2026-12-01') }
    expect(prefetchTargets(reviews, ids, TODAY, 14, 2)).toEqual(['R07_T_RK_02_A', 'R07_T_RK_02_C'])
  })
  it('肢IDとして不正な ID（電験の問題ID等）は含めない。重複は1件に畳む', () => {
    const reviews = Object.fromEntries([rev('dc_01', TODAY), rev('R07_T_RK_03_A', TODAY)].map(r => [r.question_id, r]))
    expect(prefetchTargets(reviews, ['dc_02', 'R07_T_RK_03_A', 'R07_T_RK_03_B'], TODAY))
      .toEqual(['R07_T_RK_03_A', 'R07_T_RK_03_B'])
  })
})
