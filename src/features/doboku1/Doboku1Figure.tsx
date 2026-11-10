// 問題の図（denken3.dbk_figures・migration 036）。登録済みなら表示し、未登録なら利用者が画像を登録する。
// 図は試験問題の一部なので本人だけが読める表に置く（リポジトリ・公開の場所には置かない。doboku1-ichiji.md §6.5）。
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { figureSrc, fitSize, splitDataUrl } from '../../lib/doboku1/figure'

interface Fig { mime: string; data: string }

/** 画像ファイルを長辺 1280px の JPEG に縮小した data URL。 */
async function shrink(file: File): Promise<{ url: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file)
  const { width, height } = fitSize(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できません')
  ctx.fillStyle = '#fff'   // 透過 PNG の背景を白に（JPEG は透過を持てない）
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bmp, 0, 0, width, height)
  bmp.close()
  return { url: canvas.toDataURL('image/jpeg', 0.85), width, height }
}

export default function Doboku1Figure({ userId, questionId }: { userId: string; questionId: string }) {
  const [fig, setFig] = useState<Fig | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase.from('dbk_figures').select('mime, data').eq('user_id', userId).eq('question_id', questionId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setMsg(`図を読み込めませんでした: ${error.message}`)
        setFig(data as Fig | null)
        setLoading(false)
      })
    return () => { alive = false }
  }, [userId, questionId])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setMsg(null)
    try {
      const { url, width, height } = await shrink(file)
      const parts = splitDataUrl(url)
      if ('error' in parts) { setMsg(parts.error); return }
      const { error } = await supabase.from('dbk_figures')
        .upsert({ user_id: userId, question_id: questionId, mime: parts.mime, data: parts.data, width, height })
      if (error) { setMsg(`保存できませんでした: ${error.message}`); return }
      setFig({ mime: parts.mime, data: parts.data })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const picker = (label: string, cls: string) => (
    <label className={`inline-block cursor-pointer ${cls} ${busy ? 'pointer-events-none opacity-50' : ''}`}>
      {busy ? '保存中…' : label}
      <input type="file" accept="image/*" className="hidden" disabled={busy}
        onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
    </label>
  )

  if (loading) return <p className="text-xs text-gray-500">図を読み込み中…</p>
  return (
    <div className="space-y-1">
      {fig ? (
        <>
          <img src={figureSrc(fig.mime, fig.data)} alt="問題の図" className="mx-auto w-full max-w-xl rounded border bg-white" />
          <div className="text-right">{picker('図を差し替える', 'text-xs text-gray-500 underline')}</div>
        </>
      ) : (
        <div className="space-y-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p>この問題は図を使います。公式の試験問題PDFの図をスクリーンショットして登録してください（あなただけが見られます）。</p>
          {picker('図を登録する', 'rounded bg-amber-600 px-3 py-1.5 font-bold text-white')}
        </div>
      )}
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </div>
  )
}
