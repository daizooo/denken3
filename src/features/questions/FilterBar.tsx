import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import type { Status } from '../../domain/types'
import { STATUS_BG, STATUS_LABEL } from '../shared/status'

const STATUS_OPTIONS: Status[] = ['S', 'A', 'B', 'C', '未着手']

// 理解度のほかに足せる絞り込みの軸（例: 出題年度・出題形式）。軸内は OR、軸間は AND。
export interface FilterGroup {
  key: string
  label: string
  options: { value: string; label: string }[]
  selected: ReadonlySet<string>
  onToggle: (value: string) => void
}

// 選択中を要約したバッジ文字列（例: B/C）。パネルを閉じている間の目印。
function summarize(statuses: Set<Status>, groups: FilterGroup[]): string[] {
  const out: string[] = []
  for (const g of groups) {
    const picked = g.options.filter(o => g.selected.has(o.value)).map(o => o.label)
    if (picked.length > 0) out.push(picked.join('/'))
  }
  if (statuses.size > 0) {
    out.push(STATUS_OPTIONS.filter(s => statuses.has(s)).join('/'))
  }
  return out
}

// 問題の絞り込み（章 × 理解度 ×（あれば）出題年度・出題形式）。復習・一覧の両タブで使う。
// 軸間はAND、軸内はOR（複数選択可）。空集合＝その軸は絞り込みなし。
//
// 章は Phase H（learning-metrics-ui-redesign）でここへ移した。以前は本文の上に
// チップ10個を並べており、常に2行を折り返しで占有していた。既定は「全章」で
// 切り替え頻度も低いため、常時見えるセレクト1個に畳んで縦の情報量を下げる。
// 選択中の章は畳んだままでも見えるので、見失うことはない。
export default function FilterBar({
  statuses, onToggleStatus, onClear,
  statusCounts, open, onToggleOpen,
  chapterCode, onChangeChapter, chapterOptions, groups = [],
}: {
  statuses: Set<Status>
  onToggleStatus: (s: Status) => void
  onClear: () => void
  statusCounts: Record<Status, number>
  open: boolean
  onToggleOpen: () => void
  chapterCode: string
  onChangeChapter: (code: string) => void
  /** 章セレクトの選択肢。code='ALL' を先頭に含める。disabled は未入力チャプター。 */
  chapterOptions: { code: string; label: string; disabled?: boolean }[]
  /** 章・理解度のほかの絞り込み軸（出題年度・出題形式など）。選択肢が無い軸は渡さない。 */
  groups?: FilterGroup[]
}) {
  const activeCount = statuses.size + groups.reduce((n, g) => n + g.selected.size, 0)
  const summary = summarize(statuses, groups)

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* ヘッダ（章セレクト ＋ 絞り込みトグル） */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* 章。常時見える1個のセレクトに畳んでいる（旧: チップ10個の折り返し2行）。 */}
        <select
          value={chapterCode}
          onChange={e => onChangeChapter(e.target.value)}
          title="章の絞り込み"
          className={`text-xs font-medium rounded-md border px-1.5 py-1 max-w-[11rem] cursor-pointer focus:outline-none focus:border-blue-400 ${
            chapterCode === 'ALL'
              ? 'bg-white text-gray-600 border-gray-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}
        >
          {chapterOptions.map(o => (
            <option key={o.code} value={o.code} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>

        <span className="w-px h-4 bg-gray-100" />

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
          {/* 出題年度・出題形式など（章の絞り込みの前段） */}
          {groups.map(g => (
            <div key={g.key}>
              <p className="text-[11px] font-medium text-gray-400 mb-1.5">{g.label}</p>
              <div className="flex gap-1.5 flex-wrap">
                {g.options.map(o => {
                  const on = g.selected.has(o.value)
                  return (
                    <button key={o.value}
                      onClick={() => g.onToggle(o.value)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        on
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >{o.label}</button>
                  )
                })}
              </div>
            </div>
          ))}
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
