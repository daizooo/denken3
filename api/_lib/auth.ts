// リクエストの認証。`_` 始まりのファイルは Vercel がエンドポイント化しない。
//
// **service role キーは使わない。** クライアントが送ってきた Supabase の JWT を
// そのまま Authorization ヘッダに載せた anon クライアントを作れば、
//   ① auth.getUser() が署名を検証して実行ユーザーを確定させ、
//   ② 以降のクエリは RLS でそのユーザーの行だけに絞られる
// の2つが同時に成立する。RLS を bypass する強い鍵をサーバへ置く理由がない。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ローカルの `vercel dev` では .env の VITE_ 付きだけがある場合もあるので両方見る。
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

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
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new HttpError(500, 'SUPABASE_URL / SUPABASE_ANON_KEY が設定されていません')
  }
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
