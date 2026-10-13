// 肢の本文を取るフック（licensehub-expansion.md §5）。
//
//   useItemBodies(ids)         … 表示する肢の本文。IndexedDB → 不足分を lic_items から200件単位で取得
//   usePrefetchItemBodies(...) … 起動時の先取り（今日〜14日先の復習＋現在の学習科目の未着手の先頭200件）
//
// 取得失敗・本文未取得の肢は bodies に入らない。表示側は isAskableItem で「出題しない」に倒す。
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ExamDefinition, Review, Subject } from '../../domain/types'
import { ITEM_BODY_COLUMNS, loadItemBodies, type ItemBody, type ItemBodyResult } from '../../lib/license/itemBody'
import { readBodies, writeBodies } from '../../lib/license/bodyCache'
import { prefetchTargets } from '../../lib/license/prefetch'

async function fetchRemote(ids: string[]): Promise<ItemBody[]> {
  const { data, error } = await supabase.from('lic_items').select(ITEM_BODY_COLUMNS).in('id', ids)
  if (error) throw error
  return (data ?? []) as unknown as ItemBody[]
}

function load(ids: string[], userId: string): Promise<ItemBodyResult> {
  return loadItemBodies(ids, {
    readCache: list => readBodies(userId, list),
    writeCache: bodies => writeBodies(userId, bodies),
    fetchRemote,
    online: typeof navigator === 'undefined' || navigator.onLine,
  })
}

export interface ItemBodiesState {
  bodies: Record<string, ItemBody>
  loading: boolean
  /** 取得できなかった ID（出題しない）。 */
  missing: string[]
  failed: boolean
}

// userId を渡すとキャッシュのキーを利用者ごとに分ける。未ログイン（null）なら何もしない。
export function useItemBodies(ids: string[], userId: string | null = null): ItemBodiesState {
  const key = ids.join(',')
  const [state, setState] = useState<ItemBodiesState & { key: string }>(
    { key: '', bodies: {}, loading: true, missing: [], failed: false },
  )
  useEffect(() => {
    if (!userId) return
    let alive = true
    const list = key === '' ? [] : key.split(',')
    void load(list, userId).then(r => {
      if (alive) setState({ key, bodies: r.bodies, loading: false, missing: r.missing, failed: r.failed })
    })
    return () => { alive = false }
  }, [key, userId])
  // ids が変わった直後（前の結果が残っている間）は loading として扱う。
  if (state.key !== key) return { bodies: {}, loading: !!userId, missing: [], failed: false }
  return state
}

/**
 * 起動時の先取り。allText の資格（社労士）でだけ動く。電験では何もしない。
 * 先取りの成否は画面に影響させない（失敗した肢は開いたときに改めて取りに行く）。
 */
export function usePrefetchItemBodies(
  userId: string | null, exam: ExamDefinition, subject: Subject,
  reviews: Record<string, Review>, today: string,
): void {
  const enabled = !!userId && exam.features.allText === true
  const subjectIds = useMemo(
    () => exam.subjects.find(s => s.name === subject)?.chapters.flatMap(c => c.questions.map(q => q.id)) ?? [],
    [exam, subject],
  )
  const key = useMemo(
    () => (enabled ? prefetchTargets(reviews, subjectIds, today).join(',') : ''),
    [enabled, reviews, subjectIds, today],
  )
  useEffect(() => {
    if (!userId || key === '') return
    void load(key.split(','), userId)
  }, [key, userId])
}
