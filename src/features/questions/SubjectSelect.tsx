// 科目（法律）の切り替え。ヘッダは資格の切り替えだけにし、科目は問題の絞り込みの一部として
// 絞り込みバー（復習・一覧）か、科目ごとに表示が変わる画面の上（ダッシュボード・設定など）に置く。
export default function SubjectSelect({
  subject, onChange, options,
}: {
  subject: string
  onChange: (subject: string) => void
  options: { value: string; label: string }[]
}) {
  if (options.length <= 1) return null
  return (
    <select
      value={subject}
      onChange={e => onChange(e.target.value)}
      title="科目の切り替え"
      className="text-xs font-medium rounded-md border px-1.5 py-1 cursor-pointer focus:outline-none focus:border-blue-400 bg-white text-gray-700 border-gray-200"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
