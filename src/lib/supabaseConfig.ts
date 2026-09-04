// Supabase の接続先（公開値）。ブラウザ側（lib/supabase.ts）と Serverless Function
// 側（api/_lib/auth.ts）の両方から読む。
//
// **anon キーはブラウザへ配られる前提の公開鍵**で、行の保護は RLS が担う。もともと
// クライアントのバンドルに入って配布されている値なので、サーバ側で同じ値を使っても
// 露出は増えない。service role キーはここには置かない（RLS を bypass するため）。
//
// 環境変数が設定されていればそちらが優先される。ここにある値は、環境変数が無い
// 環境（設定漏れ・ローカルの vercel dev）で動かなくならないための既定値である。
// 定義を1か所にしているのは、プロジェクトの参照先が2通りに分かれるのを防ぐため。

export const SUPABASE_URL_DEFAULT = 'https://jmysgeulujggdmdthqkn.supabase.co'

export const SUPABASE_ANON_KEY_DEFAULT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteXNnZXVsdWpnZ2RtZHRocWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODUxMDUsImV4cCI6MjA5OTg2MTEwNX0.LwZ6i0dG6ikqd_7dSYQhgh3A2j5n7EbgakpcgsWCBzA'
