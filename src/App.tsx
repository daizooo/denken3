import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { User } from '@supabase/supabase-js'
import { BookOpen, TrendingUp, Save } from 'lucide-react'

// ==============================
// TYPES
// ==============================
type Status = 'A' | 'A-' | 'B' | 'C' | 'D' | '未着手'

interface MasterQuestion {
  id: string
  number: number
  title: string
  difficulty: 1 | 2 | 3
  importance?: 1 | 2 | 3
}

interface Chapter {
  code: string
  name: string
  subject: Subject
  totalCount: number   // オーム社原本の問題数（捨て問含む）
  questions: MasterQuestion[]
}

type Subject = '理論' | '電力' | '機械' | '法規'

interface Review {
  question_id: string
  status: Status
  stability: number
  difficulty_fsrs: number
  due_date: string | null
  repetitions: number
  lapses: number
  last_reviewed: string | null
  tags: string[]
  memo: string
}

// ==============================
// MASTER DATA
// 問題を解いた章から順次追加する
// id命名規則: {chapter_code}_{original_book_number}
// 捨て問はそもそもMASTERに載せない
// ==============================

const AC3_QUESTIONS: MasterQuestion[] = [
  { id: 'ac3_1',  number: 1,  title: 'Y結線：相電圧・線間電圧・電力の関係',                    difficulty: 1 },
  { id: 'ac3_2',  number: 2,  title: 'Y結線：平衡三相回路の全消費電力',                         difficulty: 1 },
  { id: 'ac3_3',  number: 3,  title: 'Y結線：各相電圧から線間電圧の大きさを求める',              difficulty: 1 },
  { id: 'ac3_4',  number: 4,  title: 'Y結線：RLC負荷の電源電流と有効電力',                      difficulty: 2 },
  { id: 'ac3_5',  number: 5,  title: 'Δ結線：平衡三相回路の線電流',                             difficulty: 1 },
  { id: 'ac3_6',  number: 6,  title: 'Δ結線：全消費電力と線電流からRとXを求める',               difficulty: 2 },
  { id: 'ac3_7',  number: 7,  title: 'Δ結線：平衡三相負荷の線電流の大きさ',                     difficulty: 2 },
  { id: 'ac3_8',  number: 8,  title: 'Δ結線：単相接続時の電力から三相接続時の電力を計算',       difficulty: 2 },
  // 問9 捨て問（1線断線）
  { id: 'ac3_10', number: 10, title: 'Δ結線：不平衡負荷の力率とRを求める',                      difficulty: 2 },
  { id: 'ac3_11', number: 11, title: 'Y-Δ混合：平衡三相回路の相電圧の大きさ',                   difficulty: 1 },
  { id: 'ac3_12', number: 12, title: 'Y-Δ混合：平衡三相回路の線電流',                           difficulty: 1 },
  { id: 'ac3_13', number: 13, title: 'Y-Δ混合：抵抗のΔ結線負荷の線間電圧と線電流',             difficulty: 1 },
  { id: 'ac3_14', number: 14, title: 'Y-Δ混合：RとCの平衡三相回路の力率',                       difficulty: 2 },
  { id: 'ac3_15', number: 15, title: 'Y結線/Y-Δ混合：RとXの平衡三相負荷のリアクタンスと消費電力', difficulty: 2 },
  { id: 'ac3_16', number: 16, title: 'Y-Δ混合：各リアクタンスに流れる電流',                     difficulty: 3 },
  // 問17 捨て問（力率=1になる条件）
  { id: 'ac3_18', number: 18, title: 'Y-Δ混合：混合負荷の抵抗と消費電力',                       difficulty: 3 },
  { id: 'ac3_19', number: 19, title: 'Y-Δ混合：RとLの負荷にCを接続して力率を1にする',           difficulty: 2 },
  { id: 'ac3_20', number: 20, title: 'Y結線/Y-Δ混合：RとLの負荷の電流と力率1にするコンデンサ',  difficulty: 2 },
  { id: 'ac3_21', number: 21, title: 'Y結線/Y-Δ混合：RとLの負荷の有効電力・力率とコンデンサ',   difficulty: 2 },
  { id: 'ac3_22', number: 22, title: 'Y-Δ混合：複素インピーダンス負荷の電流計算',               difficulty: 3 },
  { id: 'ac3_23', number: 23, title: 'Y-Δ混合：LとRの負荷の有効電力とコンデンサ',               difficulty: 2 },
  { id: 'ac3_24', number: 24, title: 'Y結線/Y-Δ混合：RとLの並列負荷の電力とコンデンサ',         difficulty: 2 },
  // 問25,26 捨て問（V結線・電源直列）
]

const TRANS_QUESTIONS: MasterQuestion[] = [
  { id: 'trans_1',  number: 1,  title: 'RL直列回路（H20-A10）',                      difficulty: 1, importance: 3 },
  { id: 'trans_2',  number: 2,  title: 'RL直列回路（H17-A9）',                        difficulty: 1, importance: 3 },
  { id: 'trans_3',  number: 3,  title: 'RC直列回路（H28-A10/R5下-A10）',              difficulty: 2, importance: 3 },
  { id: 'trans_4',  number: 4,  title: 'RC直列回路（H18-A10）',                       difficulty: 1, importance: 3 },
  { id: 'trans_5',  number: 5,  title: 'RC直列回路（H30-A10）',                       difficulty: 1, importance: 3 },
  { id: 'trans_6',  number: 6,  title: 'RC直列回路 ほか（R1-A10）',                   difficulty: 1, importance: 3 },
  { id: 'trans_7',  number: 7,  title: 'RC直列回路／RC直並列回路（H19-A10）',          difficulty: 1, importance: 3 },
  { id: 'trans_8',  number: 8,  title: 'RC直列回路（H15-A9）',                        difficulty: 2, importance: 3 },
  { id: 'trans_9',  number: 9,  title: 'RL直列回路（H21-A10）',                       difficulty: 2, importance: 3 },
  { id: 'trans_10', number: 10, title: 'RL直列回路／RC直列回路（H27-A10）',            difficulty: 2, importance: 3 },
  { id: 'trans_11', number: 11, title: 'RL直列回路（R3-A10）',                        difficulty: 2, importance: 3 },
  // 問12 捨て問（RL直並列回路）
  { id: 'trans_13', number: 13, title: 'RC直列回路（H23-A10）',                       difficulty: 2, importance: 3 },
  { id: 'trans_14', number: 14, title: 'RL直列回路／RL直並列回路（H24-A9）',           difficulty: 2, importance: 3 },
  { id: 'trans_15', number: 15, title: 'RC直列回路／RC直並列回路（H26-A11）',          difficulty: 2, importance: 3 },
  // 問16 捨て問（RL直列回路／RLC直並列回路）
  // 問17 捨て問（RL直列回路／RLC直並列回路）
  // 問18 捨て問（RC直並列回路）
  // 問19 捨て問（RC直列回路 ほか）
]

// 他の章は問題を解いた順に追加する
// 捨て問リスト（参照用コメント）:
//   直流回路  : 問31,37,72
//   単相交流  : 問42,49,51
//   三相交流  : 問9,17,25,26
//   過渡現象  : 問12,16,17,18,19
//   静電気    : 問17,21,31,70
//   電磁気    : 問30
//   電気計測  : 問2,22,29,39,44,48
//   電子理論  : 問5,9,20,45
//   電子回路  : 問13,14,15,41,46,54

const CHAPTERS: Chapter[] = [
  { code: 'dc',       name: '直流回路',  subject: '理論', totalCount: 69, questions: [] },
  { code: 'trans',    name: '過渡現象',  subject: '理論', totalCount: 14, questions: TRANS_QUESTIONS },
  { code: 'ac1',      name: '単相交流',  subject: '理論', totalCount: 48, questions: [] },
  { code: 'ac3',      name: '三相交流',  subject: '理論', totalCount: 22, questions: AC3_QUESTIONS },
  { code: 'elec',     name: '静電気',    subject: '理論', totalCount: 66, questions: [] },
  { code: 'mag',      name: '電磁気',    subject: '理論', totalCount: 29, questions: [] },
  { code: 'meas',     name: '電気計測',  subject: '理論', totalCount: 42, questions: [] },
  { code: 'etheory',  name: '電子理論',  subject: '理論', totalCount: 41, questions: [] },
  { code: 'ecircuit', name: '電子回路',  subject: '理論', totalCount: 48, questions: [] },
  // 電力・機械・法規は追加予定
]

const SUBJECTS: Subject[] = ['理論', '電力', '機械', '法規']

const COMMON_TAGS = ['公式忘れ', '計算ミス', '単位ミス', '勘違い', '時間切れ', '初見']

const STATUS_BG: Record<Status, string> = {
  'A':    'bg-green-100 text-green-800 border-green-300',
  'A-':   'bg-teal-100 text-teal-800 border-teal-300',
  'B':    'bg-blue-100 text-blue-800 border-blue-300',
  'C':    'bg-yellow-100 text-yellow-800 border-yellow-300',
  'D':    'bg-red-100 text-red-800 border-red-300',
  '未着手': 'bg-gray-100 text-gray-800 border-gray-300',
}

const STATUS_COLOR: Record<Status, string> = {
  'A': '#22c55e', 'A-': '#14b8a6', 'B': '#3b82f6',
  'C': '#eab308', 'D': '#ef4444', '未着手': '#9ca3af',
}

// ==============================
// FSRS (簡易実装)
// ==============================
function calcFSRS(current: Partial<Review> | null, status: Status) {
  const rMap: Record<Status, number> = { D: 1, C: 2, B: 2, 'A-': 3, A: 4, '未着手': 3 }
  const r = rMap[status]
  let stability   = current?.stability      ?? 0
  let diff        = current?.difficulty_fsrs ?? 5
  let reps        = current?.repetitions    ?? 0
  const lastReviewed = current?.last_reviewed ?? null
  const today = new Date().toISOString().split('T')[0]

  if (reps === 0) {
    const initS: Record<number, number> = { 1: 0.4, 2: 0.6, 3: 2.4, 4: 5.8 }
    const initD: Record<number, number> = { 1: 7.15, 2: 5.5, 3: 4.0, 4: 2.5 }
    stability = initS[r]; diff = initD[r]
  } else {
    const elapsed = Math.max(0, Math.floor(
      (new Date(today).getTime() - new Date(lastReviewed!).getTime()) / 86400000
    ))
    const retrievability = Math.exp(Math.log(0.9) * elapsed / Math.max(stability, 0.1))
    diff = Math.min(Math.max(diff + (r === 1 ? 1 : r === 2 ? 0.5 : r === 3 ? -0.2 : -0.5), 1), 10)
    if (r === 1) {
      stability = Math.max(0.1, stability * 0.2)
    } else {
      const factor = Math.exp(0.1 * (10 - diff)) * (1.1 - retrievability)
      stability = stability * (1 + factor * (r === 2 ? 0.5 : 1.0) * (r === 4 ? 1.3 : 1.0))
    }
  }

  const interval = r === 1 ? 1 : Math.max(1, Math.round(stability))
  const due = new Date(today)
  due.setDate(due.getDate() + interval)

  return {
    stability,
    difficulty_fsrs: diff,
    repetitions: reps + 1,
    lapses: r === 1 ? (current?.lapses ?? 0) + 1 : (current?.lapses ?? 0),
    due_date: due.toISOString().split('T')[0],
    last_reviewed: today,
  }
}

function formatDue(dateStr: string | null): string {
  if (!dateStr) return '未定'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}日遅延`
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  return `${diff}日後`
}

function defaultReview(questionId: string): Review {
  return {
    question_id: questionId, status: '未着手',
    stability: 0, difficulty_fsrs: 5,
    due_date: null, repetitions: 0, lapses: 0,
    last_reviewed: null, tags: [], memo: '',
  }
}

// ==============================
// LOGIN SCREEN
// ==============================
function LoginScreen() {
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

// ==============================
// MAIN APP
// ==============================
export default function App() {
  const [user, setUser]           = useState<User | null>(null)
  const [reviews, setReviews]     = useState<Record<string, Review>>({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [activeTab, setActiveTab] = useState<'review' | 'list' | 'dashboard'>('review')
  const [subject, setSubject]     = useState<Subject>('理論')
  const [chapterCode, setChapterCode] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMemo, setEditMemo]   = useState('')
  const [editTags, setEditTags]   = useState<string[]>([])

  // ---- Auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session?.user) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ---- Fetch reviews ----
  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase
      .from('denken_reviews')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.error(error)
        if (data) {
          const map: Record<string, Review> = {}
          data.forEach(r => { map[r.question_id] = r as Review })
          setReviews(map)
        }
        setLoading(false)
      })
  }, [user])

  // ---- Update status ----
  const updateStatus = useCallback(async (questionId: string, status: Status) => {
    if (!user || status === '未着手') return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const fsrs = calcFSRS(current, status)
    const updated: Review = { ...current, status, ...fsrs }

    setReviews(prev => ({ ...prev, [questionId]: updated }))
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert({
      user_id: user.id, ...updated,
    })
    if (error) console.error(error)
    setSaving(false)
  }, [user, reviews])

  // ---- Save memo/tags ----
  const saveDetails = useCallback(async (questionId: string) => {
    if (!user) return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const updated: Review = { ...current, memo: editMemo, tags: editTags }

    setReviews(prev => ({ ...prev, [questionId]: updated }))
    setSaving(true)
    await supabase.from('denken_reviews').upsert({
      user_id: user.id, ...updated,
    })
    setSaving(false)
    setEditingId(null)
  }, [user, reviews, editMemo, editTags])

  // ---- Derived data ----
  const currentChapters = useMemo(
    () => CHAPTERS.filter(c => c.subject === subject),
    [subject]
  )

  const allQuestions = useMemo(() => {
    const chaps = chapterCode === 'ALL'
      ? currentChapters
      : currentChapters.filter(c => c.code === chapterCode)
    return chaps.flatMap(c =>
      c.questions.map(q => ({ ...q, chapterName: c.name, chapterCode: c.code }))
    )
  }, [currentChapters, chapterCode])

  const filteredQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      const r = reviews[q.id]
      const status = r?.status ?? '未着手'
      if (activeTab === 'review') {
        const today = new Date().toISOString().split('T')[0]
        const isDue = status === '未着手' || (r?.due_date && r.due_date <= today)
        if (!isDue) return false
      }
      if (filterStatus !== 'ALL' && status !== filterStatus) return false
      return true
    })
  }, [allQuestions, reviews, activeTab, filterStatus])

  const dashData = useMemo(() => {
    const counts: Record<Status, number> = { A: 0, 'A-': 0, B: 0, C: 0, D: 0, '未着手': 0 }
    allQuestions.forEach(q => { counts[reviews[q.id]?.status ?? '未着手']++ })

    const pieData = (Object.entries(counts) as [Status, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v, color: STATUS_COLOR[k] }))

    const today = new Date().toISOString().split('T')[0]
    const scheduleData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() + i)
      const dStr = d.toISOString().split('T')[0]
      const count = allQuestions.filter(q => {
        const due = reviews[q.id]?.due_date
        return i === 0 ? due && due <= dStr : due === dStr
      }).length
      return { date: i === 0 ? '今日' : i === 1 ? '明日' : `${i}日後`, count }
    })
    return { counts, pieData, scheduleData }
  }, [allQuestions, reviews])

  // ---- Render guards ----
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">読み込み中...</p>
    </div>
  )
  if (!user) return <LoginScreen />

  const inputChapters = currentChapters.filter(c => c.questions.length > 0)
  const totalQ = allQuestions.length
  const masteredQ = allQuestions.filter(q => reviews[q.id]?.status === 'A').length
  const todayDue = allQuestions.filter(q => {
    const r = reviews[q.id]
    const today = new Date().toISOString().split('T')[0]
    return r?.status === '未着手' || (r?.due_date && r.due_date <= today)
  }).length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* ===== HEADER ===== */}
        <header className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              <span className="font-bold text-gray-800 text-base">電験3種 過去問マスター</span>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              {saving && <Save size={12} className="animate-pulse text-blue-400" />}
              <span>{saving ? '保存中...' : `今日の復習 ${todayDue}問`}</span>
            </div>
          </div>

          {/* 科目タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {SUBJECTS.map(s => {
              const count = CHAPTERS.filter(c => c.subject === s)
                .reduce((sum, c) => sum + c.questions.length, 0)
              return (
                <button key={s}
                  onClick={() => { setSubject(s); setChapterCode('ALL') }}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    subject === s ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s}
                  {count > 0 && <span className="ml-1 text-gray-400">({count})</span>}
                </button>
              )
            })}
          </div>

          {/* 表示タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['review', 'list', 'dashboard'] as const).map(t => (
              <button key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'review' ? `今日の復習 (${todayDue})` : t === 'list' ? '全問題' : '分析'}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <DashboardView
            data={dashData}
            chapters={inputChapters}
            reviews={reviews}
            totalQ={totalQ}
            masteredQ={masteredQ}
          />
        ) : (
          <>
            {/* ===== CHAPTER FILTER ===== */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setChapterCode('ALL')}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  chapterCode === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >全章 ({totalQ}問)</button>

              {inputChapters.map(c => {
                const today = new Date().toISOString().split('T')[0]
                const dueCount = c.questions.filter(q => {
                  const r = reviews[q.id]
                  return r?.status === '未着手' || (r?.due_date && r.due_date <= today)
                }).length
                return (
                  <button key={c.code}
                    onClick={() => setChapterCode(c.code)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      chapterCode === c.code
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {c.name} ({c.questions.length})
                    {activeTab === 'review' && dueCount > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1 py-px">{dueCount}</span>
                    )}
                  </button>
                )
              })}

              {/* 未入力チャプターのプレースホルダー */}
              {currentChapters.filter(c => c.questions.length === 0).map(c => (
                <span key={c.code}
                  className="px-3 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-400 cursor-not-allowed"
                  title={`${c.totalCount}問 - 未入力`}
                >{c.name} (未)</span>
              ))}
            </div>

            {/* ===== STATUS FILTER (list only) ===== */}
            {activeTab === 'list' && (
              <div className="flex gap-1.5 flex-wrap">
                {(['ALL', 'A', 'A-', 'B', 'C', 'D', '未着手'] as const).map(s => (
                  <button key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >{s === 'ALL' ? 'すべて' : s}</button>
                ))}
              </div>
            )}

            {/* ===== QUESTION LIST ===== */}
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-gray-400 text-sm">
                  {activeTab === 'review'
                    ? '今日の復習はありません'
                    : '表示できる問題がありません'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => {
                  const review = reviews[q.id] ?? defaultReview(q.id)
                  const isEditing = editingId === q.id

                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                      <div className="p-3.5">
                        {/* Meta */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">{q.chapterName} 問{q.number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BG[review.status]}`}>
                            {review.status}
                          </span>
                          {review.due_date && review.status !== '未着手' && (
                            <span className={`text-xs ${
                              formatDue(review.due_date).includes('遅延') ? 'text-red-500' :
                              formatDue(review.due_date) === '今日' ? 'text-orange-500' : 'text-gray-400'
                            }`}>
                              {formatDue(review.due_date)}
                            </span>
                          )}
                          {'difficulty' in q && (
                            <span className="text-xs text-gray-300">{'★'.repeat(q.difficulty as number)}</span>
                          )}
                        </div>

                        {/* Title */}
                        <p className="text-sm font-medium text-gray-800 leading-snug">{q.title}</p>

                        {/* Tags */}
                        {review.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {review.tags.map(t => (
                              <span key={t} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Memo preview */}
                        {review.memo && !isEditing && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{review.memo}</p>
                        )}

                        {/* Status buttons */}
                        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                          {(['A', 'A-', 'B', 'C', 'D'] as Status[]).map(s => (
                            <button key={s}
                              onClick={() => updateStatus(q.id, s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                                review.status === s
                                  ? `${STATUS_BG[s]} scale-105 shadow-sm`
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
                              }`}
                            >{s}</button>
                          ))}
                          <button
                            onClick={() => {
                              if (isEditing) {
                                setEditingId(null)
                              } else {
                                setEditingId(q.id)
                                setEditMemo(review.memo)
                                setEditTags([...review.tags])
                              }
                            }}
                            className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          >{isEditing ? '閉じる' : 'メモ'}</button>
                        </div>

                        {/* Edit panel */}
                        {isEditing && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1.5">タグ</p>
                              <div className="flex gap-1.5 flex-wrap">
                                {COMMON_TAGS.map(t => (
                                  <button key={t}
                                    onClick={() => setEditTags(prev =>
                                      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                    )}
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                      editTags.includes(t)
                                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                  >{t}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1.5">メモ</p>
                              <textarea
                                value={editMemo}
                                onChange={e => setEditMemo(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 h-24 resize-none focus:outline-none focus:border-blue-300 bg-white"
                                placeholder="公式・間違えたポイントなど..."
                              />
                            </div>
                            <button
                              onClick={() => saveDetails(q.id)}
                              className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >保存</button>
                          </div>
                        )}

                        {/* FSRS debug (collapsed) */}
                        {review.repetitions > 0 && !isEditing && (
                          <p className="text-xs text-gray-300 mt-1.5">
                            {review.repetitions}回 / 安定度{review.stability.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}

// ==============================
// DASHBOARD
// ==============================
function DashboardView({
  data, chapters, reviews, totalQ, masteredQ
}: {
  data: { counts: Record<Status, number>; pieData: any[]; scheduleData: any[] }
  chapters: Chapter[]
  reviews: Record<string, Review>
  totalQ: number
  masteredQ: number
}) {
  const pct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0

  return (
    <div className="space-y-4">

      {/* 概要カード */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '完答(A)', value: data.counts.A, color: 'text-green-600' },
          { label: '習得中(A-〜B)', value: data.counts['A-'] + data.counts.B, color: 'text-blue-600' },
          { label: '要復習(C+D)', value: data.counts.C + data.counts.D, color: 'text-red-500' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* チャート行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-500" />理解度分布
            </h3>
            <span className="text-2xl font-bold text-blue-600">{pct}%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data.pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">今後7日間の復習予定</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.scheduleData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="問題数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 章別進捗 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">章別進捗</h3>
        <div className="space-y-2.5">
          {chapters.map(c => {
            const done = c.questions.filter(q =>
              ['A', 'A-', 'B'].includes(reviews[q.id]?.status ?? '')
            ).length
            const pct = c.questions.length > 0 ? (done / c.questions.length) * 100 : 0
            const mastered = c.questions.filter(q => reviews[q.id]?.status === 'A').length

            return (
              <div key={c.code}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="font-medium">{c.name}</span>
                  <span>{mastered}完答 / {done}習得中 / {c.questions.length}問</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
