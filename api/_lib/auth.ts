// リクエストの認証。`_` 始まりのファイルは Vercel がエンドポイント化しない。
//
// **service role キーは使わない。** クライアントが送ってきた Supabase の JWT を
// そのまま Authorization ヘッダに載せた anon クライアントを作れば、
//   ① auth.getUser() が署名を検証して実行ユーザーを確定させ、
//   ② 以降のクエリは RLS でそのユーザーの行だけに絞られる
// の2つが同時に成立する。RLS を bypass する強い鍵をサーバへ置く理由がない。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY_DEFAULT, SUPABASE_URL_DEFAULT } from '../../src/lib/supabaseConfig.js'

// 環境変数が優先。ローカルの `vercel dev` では VITE_ 付きだけがある場合もあるので両方見る。
// どちらも無ければ公開の既定値（ブラウザ側と同じ定義を共有する）へ落とす ―― 設定漏れで
// 「押しても500」になるのを避けるため。service role キーはここでは一切使わない。
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? SUPABASE_URL_DEFAULT
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY_DEFAULT

export interface AuthContext {
  supabase: SupabaseClient
  userId: string
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function authenticate(req: Request): Promise<AuthContext> {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, '認証が必要です')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'トークンが無効です')

  return { supabase, userId: data.user.id }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
