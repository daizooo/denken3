// 1級土木の単体コピー（会社学習用）。問題文・選択肢のあと25行の空行を挟んで正答・解説を置く（copyText.ts）。
import { useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import { formatDbkForClipboard } from '../../lib/doboku1/copyText'

export default function Doboku1CopyButton({ q }: { q: DbkQuestionRow }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatDbkForClipboard(q))
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }
  return (
    <button onClick={copy} title="テキストをコピー（答えは25行下）"
      className="ml-auto flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
      {state === 'copied' ? <Check size={12} className="text-green-600" /> : <ClipboardCopy size={12} />}
      {state === 'copied' ? 'コピーしました' : state === 'failed' ? 'コピー不可' : 'コピー'}
    </button>
  )
}
