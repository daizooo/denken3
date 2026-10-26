// 選択式の問の正答（lic_questions.answer_spec）を取るフック。
//
// 肢の本文（useItemBodies）は lic_items だけを取るため、空欄の正答と語群は別に取る。
// 前回取れた値を localStorage に残し、オフラインでも開けるようにする（オンラインなら取り直して差し替える）。
// localStorage が使えない環境では毎回 DB から取る。
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AnswerSpec } from '../../domain/license'

const cacheKey = (userId: string, questionId: string) => `lic_sentaku_spec:${userId}:${questionId}`

function readCache(userId: string, questionId: string): AnswerSpec | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId, questionId))
    return raw ? (JSON.parse(raw) as AnswerSpec) : null
  } catch {
    return null
  }
}

function writeCache(userId: string, questionId: string, spec: AnswerSpec): void {
  try {
    localStorage.setItem(cacheKey(userId, questionId), JSON.stringify(spec))
  } catch {
    // 保存できなくても表示は妨げない
  }
}

export interface SentakuSpecState {
  spec: AnswerSpec | null
  loading: boolean
}

export function useSentakuSpec(questionId: string | null, userId: string): SentakuSpecState {
  const [state, setState] = useState<{ key: string; spec: AnswerSpec | null; loading: boolean }>(
    { key: '', spec: null, loading: true },
  )
  const key = questionId ? `${userId}:${questionId}` : ''
  useEffect(() => {
    if (!questionId) return
    let alive = true
    const cached = readCache(userId, questionId)
    void (async () => {
      try {
        const { data, error } = await supabase.from('lic_questions').select('answer_spec').eq('id', questionId).maybeSingle()
        if (error) throw error
        const spec = (data?.answer_spec ?? null) as AnswerSpec | null
        if (spec) writeCache(userId, questionId, spec)
        if (alive) setState({ key, spec: spec ?? cached, loading: false })
      } catch {
        if (alive) setState({ key, spec: cached, loading: false })
      }
    })()
    return () => { alive = false }
  }, [key, questionId, userId])
  if (!questionId) return { spec: null, loading: false }
  if (state.key !== key) return { spec: readCache(userId, questionId), loading: true }
  return { spec: state.spec, loading: state.loading }
}
