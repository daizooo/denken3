import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import type { Status, StudyMode } from '../../domain/types'
import { STATUS_BG, STATUS_LABEL } from '../shared/status'

// 学習場所（studyMode）の絞り込みキー。未設定（機械/電力/法規や未分類の理論）は 'unset' に集約する。
export type ModeKey = StudyMode | 'unset'

// 学習場所チップの表示定義（会社=暗記・概念 / 自宅=計算。types.ts §StudyMode）。
const MODE_OPTIONS: { key: ModeKey; label: string; title: string }[] = [
  { key: 'calc',   label: '🏠 自宅（計算）', title: '計算問題（立式・紙で式展開）。自宅向け' },
  { key: 'memory', label: '🏢 会社（暗記）', title: '暗記・概念問題（論説・穴埋・選択）。会社の休憩向け' },
  { key: 'unset',  label: '未分類',          title: '学習場所が未設定の問題' },
]

const STATUS_OPTIONS: Status[] = ['S', 'A', 'B', 'C', '未着手']

// 選択中を要約したバッジ文字列（例: 🏢会社 · B/C）。パネルを閉じている間の目印。
function summarize(modes: Set<ModeKey>, statuses: Set<Status>): string[] {
  const out: string[] = []
  if (modes.size > 0) {
    out.push(MODE_OPTIONS.filter(o => modes.has(o.key)).map(o => o.label.replace(/（.*）/, '').trim()).join('・'))
  }
  if (statuses.size > 0) {
    out.push(STATUS_OPTIONS.filter(s => statuses.has(s)).join('/'))
  }
  return out
}

// 問題の絞り込みパネル（学習場所 × 理解度）。復習・一覧の両タブで使う。
// 軸間はAND、軸内はOR（複数選択可）。空集合＝その軸は絞り込みなし。
export default function FilterBar({
  modes, statuses, onToggleMode, onToggleStatus, onClear,
  modeCounts, statusCounts, open, onToggleOpen,
}: {
  modes: Set<ModeKey>
  statuses: Set<Status>
  onToggleMode: (m: ModeKey) => void
  onToggleStatus: (s: Status) => void
  onClear: () => void
  modeCounts: Record<ModeKey, number>
  statusCounts: Record<Status, number>
  open: boolean
  onToggleOpen: () => void
}) {
  const activeCount = modes.size + statuses.size
  const summary = summarize(modes, statuses)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* ヘッダ（トグル） */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          <SlidersHorizontal size={14} className="text-gray-400" />
          絞り込み
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* 閉じている間の要約バッジ */}
        {!open && summary.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {summary.map((s, i) => (
              <span key={i} className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                {s}
              </span>
            ))}
          </div>
        )}

        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-gray-600"
          >
            <X size={12} /> クリア
          </button>
        )}
      </div>

      {/* パネル本体 */}
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-50">
          {/* 学習場所 */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-1.5">学習場所</p>
            <div className="flex gap-1.5 flex-wrap">
              {MODE_OPTIONS.map(o => {
                const on = modes.has(o.key)
                return (
                  <button key={o.key}
                    onClick={() => onToggleMode(o.key)}
                    title={o.title}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      on
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {o.label}
                    <span className={`ml-1 ${on ? 'text-blue-100' : 'text-gray-300'}`}>{modeCounts[o.key] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 理解度 */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 mb-1.5">理解度</p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(s => {
                const on = statuses.has(s)
                return (
                  <button key={s}
                    onClick={() => onToggleStatus(s)}
                    title={STATUS_LABEL[s]}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      on
                        ? 'bg-blue-600 text-white border-blue-600'
                        : `bg-white border-gray-200 hover:border-blue-300 ${STATUS_BG[s].split(' ').find(c => c.startsWith('text-')) ?? 'text-gray-500'}`
                    }`}
                  >
                    {s}
                    <span className={`ml-1 ${on ? 'text-blue-100' : 'text-gray-300'}`}>{statusCounts[s] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
