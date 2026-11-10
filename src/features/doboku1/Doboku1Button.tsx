// ヘッダーから1級土木の演習画面を開く入口（資格レジストリ EXAMS には載せない＝社労士の画面・集計に混ぜない）。
import { useState } from 'react'
import { HardHat } from 'lucide-react'
import Doboku1Practice from './Doboku1Practice'

export default function Doboku1Button({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} title="1級土木 第一次検定の演習"
        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
        <HardHat size={13} />
      </button>
      {open && <Doboku1Practice userId={userId} onClose={() => setOpen(false)} />}
    </>
  )
}
