import { NotebookPen } from 'lucide-react'

// 問題／ノート／解答の3択スイッチ。問題画面のトップバーと、ノート画面のツールバーの
// 両方に同じものを出し、どちらの画面からでも1タップで行き来できるようにする。
export type ViewMode = 'question' | 'note' | 'answer'

const OPTIONS: { key: ViewMode; label: string }[] = [
  { key: 'question', label: '問題' },
  { key: 'note', label: 'ノート' },
  { key: 'answer', label: '解答' },
]

export default function ViewSwitch({
  value, onChange,
}: {
  value: ViewMode
  onChange: (next: ViewMode) => void
}) {
  return (
    <div className="flex shrink-0 rounded-lg border-2 border-blue-600 overflow-hidden">
      {OPTIONS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex items-center gap-1 px-3 py-1 text-xs font-bold transition-colors ${
            value === o.key ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
          }`}
        >
          {o.key === 'note' && <NotebookPen size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
