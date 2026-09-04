import { AlertTriangle } from 'lucide-react'
import type { PlanAlert } from '../../lib/planAlert'

// 分析タブの警告は**この1枚だけ**（review-display-analysis-warnings）。
//
// 統合前は「時間が足りません」（赤）と「遅延が続いています」（黄）が同時に立ち、
// 選択肢が6項目に膨らんでいた。原因は1つで選択肢も重複しているため、
// 文面の組み立ては lib/planAlert.ts に寄せ、ここは描画だけを持つ。
// 常時2枚出る警告は読み飛ばされ、本当に足りない日に効かなくなる。
export default function PlanAlertCard({ alert }: { alert: PlanAlert | null }) {
  if (!alert) return null
  const cls = alert.level === 'shortfall'
    ? { box: 'bg-red-50 border-red-200', head: 'text-red-700', body: 'text-red-800', sub: 'text-red-500' }
    : { box: 'bg-amber-50 border-amber-200', head: 'text-amber-700', body: 'text-amber-800', sub: 'text-amber-500' }

  return (
    <div className={`border rounded-2xl p-4 space-y-2 ${cls.box}`}>
      <h3 className={`text-sm font-semibold flex items-center gap-1.5 ${cls.head}`}>
        <AlertTriangle size={14} />{alert.headline}
      </h3>

      {alert.facts.map(f => (
        <p key={f} className={`text-xs leading-relaxed ${cls.body}`}>{f}</p>
      ))}

      <ul className="space-y-1 pt-0.5">
        {alert.choices.map(c => (
          <li key={c.key} className={`text-[11px] leading-relaxed ${cls.body}`}>
            <span className="font-medium">・{c.title}</span>
            <span className={cls.sub}> — {c.detail}</span>
          </li>
        ))}
      </ul>

      {alert.note && <p className={`text-[10px] ${cls.sub}`}>{alert.note}</p>}
    </div>
  )
}
