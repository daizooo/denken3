import { BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4 w-72">
        <BookOpen size={36} className="mx-auto text-blue-600" />
        <h1 className="text-lg font-bold text-gray-800">電験3種 過去問マスター</h1>
        <p className="text-xs text-gray-500">2027/2 理論CBT 合格まで</p>
        <button
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          })}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Googleでログイン
        </button>
      </div>
    </div>
  )
}
