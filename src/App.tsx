import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { BookOpen, Save, LogOut, Upload, Settings } from 'lucide-react'
import ProblemViewer from './components/ProblemViewer'
import ImportPanel from './components/ImportPanel'
import type { ExamId, ExamPlan, MockSession, Review, ReviewHistoryEntry, ReviewSnapshot, Status, Subject } from './domain/types'
import { EXAMS, DEFAULT_EXAM_ID, getExam, subjectNamesOf, chaptersOf, papersForSubject, subjectIdOf } from './data/registry'
import { addDaysStr, diffDays, formatMD, REVIEW_WINDOW_DAYS, toDateStr, todayJST } from './lib/date'
import { deriveFromHistory, defaultReview } from './lib/fsrs'
import { analyzePace, applicationReminder } from './lib/pace'
import { chapterWeaknessRanking, weeklyLearningCurve, quadrantMatrix, estimateScore } from './lib/analytics'
import { startTimer, pauseTimer, resumeTimer, elapsedSeconds, type TimerState } from './lib/timer'
import { STATUS_COLOR } from './features/shared/status'
import LoginScreen from './features/auth/LoginScreen'
import DashboardView from './features/dashboard/DashboardView'
import SettingsView from './features/settings/SettingsView'
import MockExamView from './features/mock-exam/MockExamView'
import QuestionCard from './features/questions/QuestionCard'

// ==============================
// MAIN APP （ルーティング・認証・データ取得のオーケストレーション）
// マスターデータは src/data/、FSRS・日付は src/lib/、UIは src/features/ に分離。
// ==============================
export default function App() {
  const [user, setUser]           = useState<User | null>(null)
  const [reviews, setReviews]     = useState<Record<string, Review>>({})
  const [plans, setPlans]         = useState<Record<string, ExamPlan>>({})
  // 年度別CBTの確定スコア（想定得点の実測補正・§7.7(4)）。分析タブでのみ使う。
  const [mockSessions, setMockSessions] = useState<MockSession[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [activeTab, setActiveTab] = useState<'review' | 'list' | 'dashboard' | 'mock' | 'settings'>('list')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayJST())
  // 対象資格（registry駆動・§7.8）。登録が1つの間は DEFAULT_EXAM_ID で固定。
  const [examId, setExamId]       = useState<ExamId>(DEFAULT_EXAM_ID)
  const [subject, setSubject]     = useState<Subject>(() => subjectNamesOf(DEFAULT_EXAM_ID)[0])
  const [chapterCode, setChapterCode] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMemo, setEditMemo]   = useState('')
  // 各問題の記録用「実施日」。未設定なら今日を使う。
  const [recordDate, setRecordDate] = useState<Record<string, string>>({})
  // 実施日ピッカーを開いている問題のID（通常は「今日」なので畳んでおく）
  const [dateOpenId, setDateOpenId] = useState<string | null>(null)
  const [viewerQ, setViewerQ] = useState<{ id: string; title: string } | null>(null)
  const [showImport, setShowImport] = useState(false)
  // 復習タブでこのセッション中に理解度を記録した問題。記録した瞬間に一覧から消すために使う。
  const [reviewedNowIds, setReviewedNowIds] = useState<Set<string>>(() => new Set())
  // 分野別の解答時間計測（§7.6）。「問題を見る」で開始、A/B/C で終了。
  // 問題IDごとの計測状態。UIの再描画とは無関係なので ref で保持する。
  const timersRef = useRef<Record<string, TimerState>>({})
  const todayStr = todayJST()
  const dateFor = (id: string) => recordDate[id] ?? todayStr

  // registry駆動の派生データ（§7.8）。資格切替（examId 変更）に追従する。
  const exam = useMemo(() => getExam(examId), [examId])
  const subjects = useMemo(() => subjectNamesOf(examId), [examId])
  const chapters = useMemo(() => chaptersOf(examId), [examId])
  const passingScore = exam.passingScore

  // ---- Auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session?.user) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setReviews({})
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // TOKEN_REFRESHED では user を更新しない（不要な再フェッチ防止）
        setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null))
        if (!session?.user) setLoading(false)
      }
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
      .eq('exam_id', examId)
      .then(({ data, error }) => {
        if (error) console.error(error)
        if (data) {
          const map: Record<string, Review> = {}
          data.forEach(r => {
            map[r.question_id] = {
              ...r,
              review_history: Array.isArray(r.review_history) ? r.review_history : [],
              last_reviewed: r.last_reviewed ? toDateStr(r.last_reviewed) : null,
              first_reviewed: r.first_reviewed ? toDateStr(r.first_reviewed) : null,
              due_date: r.due_date ? toDateStr(r.due_date) : null,
            } as Review
          })
          setReviews(map)
        }
        setLoading(false)
      })
  }, [user, examId])

  // ---- Fetch exam plans（試験日程・§7.1）----
  useEffect(() => {
    if (!user) return
    supabase
      .from('denken_exam_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .then(({ data, error }) => {
        if (error) { console.error(error); return }
        if (!data) return
        const map: Record<string, ExamPlan> = {}
        data.forEach(p => {
          map[p.subject_id] = {
            exam_id: p.exam_id,
            subject_id: p.subject_id,
            label: p.label ?? '',
            exam_date: p.exam_date ? toDateStr(p.exam_date) : null,
            application_start: p.application_start ? toDateStr(p.application_start) : null,
            application_end: p.application_end ? toDateStr(p.application_end) : null,
            bunya_target_date: p.bunya_target_date ? toDateStr(p.bunya_target_date) : null,
            nendo_start_date: p.nendo_start_date ? toDateStr(p.nendo_start_date) : null,
          }
        })
        setPlans(map)
      })
  }, [user, examId])

  // ---- Fetch mock sessions（年度別CBTの確定スコア・§7.7(4)）----
  // 想定得点の実測補正に使う。分析タブの推定に必要な最小限のみ取得する。
  useEffect(() => {
    if (!user) return
    supabase
      .from('denken_mock_sessions')
      .select('id, exam_id, subject_id, paper_id, mode, status, started_at, finished_at, score, section_scores')
      .eq('user_id', user.id)
      .eq('exam_id', examId)
      .then(({ data, error }) => {
        if (error) { console.error(error); return }
        setMockSessions((data ?? []).map(s => ({
          id: s.id, exam_id: s.exam_id, subject_id: s.subject_id, paper_id: s.paper_id,
          mode: s.mode, status: s.status, started_at: s.started_at, finished_at: s.finished_at ?? null,
          remaining_seconds: null, answers: {}, score: s.score ?? null,
          section_scores: s.section_scores ?? null, memo: '',
        })))
      })
  }, [user, examId])

  // タブが非表示の間は解答時間の計測を止める（離席・中断時間を混入させない・§7.6）。
  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden
      const timers = timersRef.current
      for (const id of Object.keys(timers)) {
        timers[id] = hidden ? pauseTimer(timers[id]) : resumeTimer(timers[id])
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // タブ・対象日を切り替えたら「復習済みで消した」記録はリセットする。
  useEffect(() => {
    setReviewedNowIds(new Set())
  }, [activeTab, selectedDate])

  // 資格を切り替えたら、その資格の先頭科目に戻し章フィルタもリセットする（§7.8）。
  useEffect(() => {
    setSubject(subjectNamesOf(examId)[0])
    setChapterCode('ALL')
  }, [examId])

  // ---- 共通: Review を1件保存（ローカル即時反映＋DB upsert）----
  const saveReview = useCallback(async (updated: Review) => {
    if (!user) return
    setReviews(prev => ({ ...prev, [updated.question_id]: updated }))
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert({
      user_id: user.id, exam_id: examId, ...updated,
    })
    if (error) console.error(error)
    setSaving(false)
  }, [user, examId])

  // ---- 共通: 履歴から Review 全体を導出して保存 ----
  // 現在の科目に試験日が設定されていれば、FSRSの復習予定日を試験日クリップする（§7.3）。
  const persistReview = useCallback(async (
    current: Review,
    history: ReviewHistoryEntry[],
  ) => {
    const examDate = plans[subjectIdOf(examId, subject)]?.exam_date ?? null
    const derived = deriveFromHistory(history, examDate)
    await saveReview({ ...current, ...derived })
  }, [saveReview, plans, examId, subject])

  // 現在のFSRS状態を「記録直前のスナップショット」として切り出す。
  const snapshotOf = (r: Review): ReviewSnapshot => ({
    status: r.status,
    stability: r.stability,
    difficulty_fsrs: r.difficulty_fsrs,
    repetitions: r.repetitions,
    lapses: r.lapses,
    due_date: r.due_date,
    last_reviewed: r.last_reviewed,
    fsrs_state: r.fsrs_state,
  })

  // ---- 実施日 + 理解度を記録（履歴に蓄積）----
  const updateStatus = useCallback(async (questionId: string, status: Status) => {
    if (!user || status === '未着手') return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const date = dateFor(questionId)
    // 解答時間（分野別・§7.6）: 「問題を見る」で開始した計測があれば秒数を付与する。
    // 無効（日跨ぎ・30分超・未計測）なら duration_seconds を付けない＝計測前扱い。
    const entry: ReviewHistoryEntry = { date, status, prev: snapshotOf(current) }
    const timer = timersRef.current[questionId]
    if (timer) {
      const sec = elapsedSeconds(timer, todayStr)
      if (sec !== undefined) entry.duration_seconds = sec
      delete timersRef.current[questionId]
    }
    // 記録直前の状態を prev として保存しておく。取消時にこの状態へ正確に戻せる。
    const history: ReviewHistoryEntry[] = [...(current.review_history ?? []), entry]
    // 復習タブでは、記録した問題を「復習済み」として即座に一覧から消す。
    if (activeTab === 'review') {
      setReviewedNowIds(prev => new Set(prev).add(questionId))
    }
    await persistReview(current, history)
  }, [user, reviews, persistReview, recordDate, activeTab, todayStr])

  // ---- 履歴エントリを取り消し（誤記録の修正用）----
  // review_history は常に実施日順で保存されるため、index はそのまま時系列順。
  // 末尾（最後に記録した分）で記録直前スナップショットを持つ場合は、
  // スケジューラで再計算せずその状態へ正確に巻き戻す。
  // これによりアルゴリズム変更（旧簡易版→ts-fsrs 等）があっても
  // 「記録前の予定日・理解度」に確実に戻る。
  const deleteEntry = useCallback(async (questionId: string, index: number) => {
    if (!user) return
    const current = reviews[questionId]
    if (!current) return
    const history = current.review_history
    const entry = history[index]
    const remaining = history.filter((_, i) => i !== index)
    const isLast = index === history.length - 1

    if (isLast && entry?.prev) {
      const p = entry.prev
      await saveReview({
        ...current,
        status: p.status,
        stability: p.stability,
        difficulty_fsrs: p.difficulty_fsrs,
        repetitions: p.repetitions,
        lapses: p.lapses,
        due_date: p.due_date,
        last_reviewed: p.last_reviewed,
        fsrs_state: p.fsrs_state,
        review_history: remaining,
        first_reviewed: remaining.length ? remaining[0].date : null,
      })
      return
    }

    // 旧データ（スナップショット無し）や途中エントリの削除は従来どおり再計算。
    await persistReview(current, remaining)
  }, [user, reviews, persistReview, saveReview])

  // ---- メモを保存 ----
  const saveDetails = useCallback(async (questionId: string) => {
    if (!user) return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const updated: Review = { ...current, memo: editMemo }

    setReviews(prev => ({ ...prev, [questionId]: updated }))
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert({
      user_id: user.id, exam_id: examId, ...updated,
    })
    if (error) console.error(error)
    setSaving(false)
    setEditingId(null)
  }, [user, examId, reviews, editMemo])

  // ---- Derived data ----
  const currentChapters = useMemo(
    () => chapters.filter(c => c.subject === subject),
    [chapters, subject]
  )

  // 画像取り込み対象になり得る（問題がある）章。分析・章別進捗の対象。
  const inputChapters = useMemo(
    () => currentChapters.filter(c => c.questions.length > 0),
    [currentChapters]
  )

  // 現在科目の全問題（章フィルタ非依存）。ペース分析の母数に使う。
  const subjectQuestions = useMemo(
    () => currentChapters.flatMap(c => c.questions.map(q => ({ id: q.id }))),
    [currentChapters]
  )

  const currentPlan = plans[subjectIdOf(examId, subject)] ?? null
  const currentPapers = useMemo(() => papersForSubject(examId, subject), [examId, subject])

  // 年度別（CBT模試）の誤答→分野別復習の前倒し（§7.4(3)）。
  // 該当する分野別問題の due_date を今日にして、今日の復習へ引き上げる。
  const boostReview = useCallback((sourceQuestionId: string) => {
    const current = reviews[sourceQuestionId] ?? defaultReview(sourceQuestionId)
    saveReview({ ...current, due_date: todayStr })
  }, [reviews, saveReview, todayStr])

  // 適応型ペース分析（§7.2）・弱点ランキング・学習曲線（§7.7(2)(3)）。
  const paceResult = useMemo(
    () => analyzePace(subjectQuestions, reviews, currentPlan, todayStr),
    [subjectQuestions, reviews, currentPlan, todayStr]
  )
  const weakness = useMemo(
    () => chapterWeaknessRanking(inputChapters, reviews),
    [inputChapters, reviews]
  )
  const learningCurve = useMemo(
    () => weeklyLearningCurve(reviews),
    [reviews]
  )
  // 理解度×時間の4象限（§7.7(1)）・本番想定得点（§7.7(4)）。
  const quadrant = useMemo(
    () => quadrantMatrix(inputChapters, reviews),
    [inputChapters, reviews]
  )
  const subjectSessions = useMemo(
    () => mockSessions.filter(s => s.subject_id === subjectIdOf(examId, subject)),
    [mockSessions, examId, subject]
  )
  const scoreEstimate = useMemo(
    () => estimateScore(currentChapters, reviews, subjectSessions, passingScore),
    [currentChapters, reviews, subjectSessions, passingScore]
  )
  const reminder = applicationReminder(currentPlan, todayStr)
  const daysToExam = currentPlan?.exam_date ? diffDays(todayStr, currentPlan.exam_date) : null

  const allQuestions = useMemo(() => {
    const chaps = chapterCode === 'ALL'
      ? currentChapters
      : currentChapters.filter(c => c.code === chapterCode)
    return chaps.flatMap(c =>
      c.questions.map(q => ({ ...q, chapterName: c.name, chapterCode: c.code }))
    )
  }, [currentChapters, chapterCode])

  const reviewSchedule = useMemo(() => {
    const today = todayJST()
    const overflowStart = addDaysStr(today, REVIEW_WINDOW_DAYS)
    // 今日を含む8日分の個別日付タブ
    const days = Array.from({ length: REVIEW_WINDOW_DAYS }, (_, i) => {
      const dStr = addDaysStr(today, i)
      const count = allQuestions.filter(q => {
        const r = reviews[q.id]
        if (i === 0) return !!(r?.due_date && r.due_date <= dStr)
        return reviews[q.id]?.due_date === dStr
      }).length
      const label = i === 0 ? '今日' : i === 1 ? '明日' : formatMD(dStr)
      return { date: dStr, label, count, isOverflow: false }
    })
    // それ以降（overflowStart 以降）をまとめる「◯/◯以降」タブ
    const overflowCount = allQuestions.filter(q => {
      const r = reviews[q.id]
      return !!(r?.due_date && r.due_date >= overflowStart)
    }).length
    days.push({
      date: overflowStart,
      label: `${formatMD(overflowStart)}以降`,
      count: overflowCount,
      isOverflow: true,
    })
    return days
  }, [allQuestions, reviews])

  const filteredQuestions = useMemo(() => {
    const today = todayJST()
    const overflowStart = addDaysStr(today, REVIEW_WINDOW_DAYS)
    return allQuestions.filter(q => {
      const r = reviews[q.id]
      const status = r?.status ?? '未着手'
      if (activeTab === 'review') {
        // 記録した瞬間に「復習済み」として消す（次回復習日が更新される前でも即反映）。
        if (reviewedNowIds.has(q.id)) return false
        if (selectedDate === today) {
          const isDue = r?.due_date && r.due_date <= today
          if (!isDue) return false
        } else if (selectedDate >= overflowStart) {
          // 「◯/◯以降」タブ: overflowStart 以降の予定をすべて表示
          if (!(r?.due_date && r.due_date >= overflowStart)) return false
        } else {
          if (!r?.due_date || r.due_date !== selectedDate) return false
        }
      }
      if (filterStatus !== 'ALL' && status !== filterStatus) return false
      return true
    })
  }, [allQuestions, reviews, activeTab, filterStatus, selectedDate, reviewedNowIds])

  // 復習タブで、記録により選択中の日付の問題がすべて片付いたら、
  // 次に問題が残っている日付タブへ自動で移動する（＝終わった感覚を出す）。
  // 記録した直後（reviewedNowIds が空でない）だけ発火させ、
  // ユーザーが手動で空の日付タブを見ている場合は移動しない。
  useEffect(() => {
    if (activeTab !== 'review') return
    if (reviewedNowIds.size === 0) return
    if (filteredQuestions.length > 0) return
    const idx = reviewSchedule.findIndex(s => s.date === selectedDate)
    if (idx === -1) return
    const next = reviewSchedule.slice(idx + 1).find(s => s.count > 0)
    if (next) setSelectedDate(next.date)
  }, [activeTab, reviewedNowIds, filteredQuestions, reviewSchedule, selectedDate])

  const dashData = useMemo(() => {
    const counts: Record<Status, number> = { A: 0, B: 0, C: 0, '未着手': 0 }
    allQuestions.forEach(q => { counts[reviews[q.id]?.status ?? '未着手']++ })

    const pieData = (Object.entries(counts) as [Status, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v, color: STATUS_COLOR[k] }))

    const today = todayJST()
    const scheduleData = Array.from({ length: 7 }, (_, i) => {
      const dStr = addDaysStr(today, i)
      const count = allQuestions.filter(q => {
        const due = reviews[q.id]?.due_date
        return i === 0 ? due && due <= dStr : due === dStr
      }).length
      return { date: i === 0 ? '今日' : i === 1 ? '明日' : `${i}日後`, count }
    })
    return { counts, pieData, scheduleData }
  }, [allQuestions, reviews])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">読み込み中...</p>
    </div>
  )
  if (!user) return <LoginScreen />

  const totalQ = allQuestions.length
  const masteredQ = allQuestions.filter(q => reviews[q.id]?.status === 'A').length
  const overflowStart = addDaysStr(todayStr, REVIEW_WINDOW_DAYS)
  const reviewDueCount = (questions: { id: string }[]) =>
    questions.filter(q => {
      const r = reviews[q.id]
      if (selectedDate === todayStr) {
        return r?.status === '未着手' || (r?.due_date && r.due_date <= todayStr)
      }
      if (selectedDate >= overflowStart) {
        return !!(r?.due_date && r.due_date >= overflowStart)
      }
      return r?.due_date === selectedDate
    }).length
  const todayDue = allQuestions.filter(q => {
    const r = reviews[q.id]
    return !!(r?.due_date && r.due_date <= todayStr)
  }).length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* ===== HEADER ===== */}
        <header className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              {/* 資格切替（§7.8）。登録が2つ以上になったらセレクタを表示、1つの間は名称のみ。 */}
              {EXAMS.length >= 2 ? (
                <select
                  value={examId}
                  onChange={e => setExamId(e.target.value)}
                  className="font-bold text-gray-800 text-base bg-transparent border-none focus:outline-none cursor-pointer"
                  title="資格の切り替え"
                >
                  {EXAMS.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-gray-800 text-base">{exam.name} 過去問マスター</span>
              )}
              {daysToExam !== null && daysToExam >= 0 && (
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {subject}試験まで あと{daysToExam}日
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              {saving && <Save size={12} className="animate-pulse text-blue-400" />}
              <span>{saving ? '保存中...' : `今日の復習 ${todayDue}問`}</span>
              <button
                onClick={() => setShowImport(true)}
                title="問題画像の取り込み"
                className="ml-1 p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Upload size={13} />
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                title="試験日程の設定"
                className={`p-1 rounded-md hover:bg-gray-100 transition-colors ${
                  activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Settings size={13} />
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                title="ログアウト"
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* 科目タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {subjects.map(s => {
              const count = chapters.filter(c => c.subject === s)
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
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              復習{todayDue > 0 ? ` (${todayDue})` : ''}
            </button>
            {(['list', 'dashboard', 'mock'] as const).map(t => {
              // 年度別タブは、ペーパー定義が無い科目では表示しない（§7.4）。
              if (t === 'mock' && currentPapers.length === 0) return null
              const label = t === 'list' ? '全問題' : t === 'dashboard' ? '分析' : '年度別'
              return (
                <button key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </header>

        {/* ===== 申込リマインドバナー（§7.1）===== */}
        {reminder.show && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
              reminder.urgent
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {reminder.message}
          </div>
        )}

        {activeTab === 'settings' ? (
          <SettingsView
            userId={user.id}
            examId={examId}
            subjectId={subjectIdOf(examId, subject)}
            subjectName={subject}
            plan={currentPlan}
            onSaved={p => setPlans(prev => ({ ...prev, [p.subject_id]: p }))}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            data={dashData}
            chapters={inputChapters}
            reviews={reviews}
            totalQ={totalQ}
            masteredQ={masteredQ}
            pace={paceResult}
            weakness={weakness}
            learningCurve={learningCurve}
            quadrant={quadrant}
            scoreEstimate={scoreEstimate}
          />
        ) : activeTab === 'mock' ? (
          <MockExamView
            userId={user.id}
            examId={examId}
            subjectId={subjectIdOf(examId, subject)}
            papers={currentPapers}
            passingScore={passingScore}
            onBoostReview={boostReview}
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
              >全章 ({activeTab === 'review' ? reviewDueCount(allQuestions) : totalQ}問)</button>

              {inputChapters.map(c => {
                const count = activeTab === 'review' ? reviewDueCount(c.questions) : c.questions.length
                return (
                  <button key={c.code}
                    onClick={() => setChapterCode(c.code)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      chapterCode === c.code
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {c.name} ({count})
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

            {/* ===== DATE STRIP (review only) ===== */}
            {activeTab === 'review' && (
              <div className="overflow-x-auto -mx-0.5 px-0.5">
                <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
                  {reviewSchedule.map(({ date, label, count }) => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs transition-colors min-w-[52px] ${
                        selectedDate === date
                          ? 'bg-blue-600 text-white border-blue-600'
                          : count > 0
                          ? 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}
                    >
                      <span className="font-medium whitespace-nowrap">{label}</span>
                      <span className={`mt-0.5 font-bold ${
                        selectedDate === date ? 'text-white' : count > 0 ? 'text-red-500' : 'text-gray-300'
                      }`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== STATUS FILTER (list only) ===== */}
            {activeTab === 'list' && (
              <div className="flex gap-1.5 flex-wrap">
                {(['ALL', 'A', 'B', 'C', '未着手'] as const).map(s => (
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
                    ? reviewedNowIds.size > 0
                      ? '🎉 この日の復習を完了しました'
                      : selectedDate === todayJST()
                        ? '今日の復習はありません'
                        : 'この日の復習予定はありません'
                    : '表示できる問題がありません'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map(q => {
                  const review = reviews[q.id] ?? defaultReview(q.id)
                  const isEditing = editingId === q.id

                  return (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      review={review}
                      activeTab={activeTab}
                      todayStr={todayStr}
                      isEditing={isEditing}
                      editMemo={editMemo}
                      onEditMemoChange={setEditMemo}
                      onToggleEdit={() => {
                        if (isEditing) {
                          setEditingId(null)
                        } else {
                          setEditingId(q.id)
                          setEditMemo(review.memo)
                        }
                      }}
                      onSaveMemo={() => saveDetails(q.id)}
                      onRecordStatus={s => updateStatus(q.id, s)}
                      onOpenViewer={() => {
                        // 解答時間の計測開始（§7.6）。A/B/C 押下時に秒数を確定する。
                        timersRef.current[q.id] = startTimer(todayStr)
                        setViewerQ({ id: q.id, title: `${q.chapterName} 問${q.number}　${q.title}` })
                      }}
                      dateValue={dateFor(q.id)}
                      dateOpen={dateOpenId === q.id}
                      onOpenDate={() => setDateOpenId(q.id)}
                      onDateChange={v => setRecordDate(prev => ({ ...prev, [q.id]: v }))}
                      onResetDate={() => {
                        setRecordDate(prev => { const next = { ...prev }; delete next[q.id]; return next })
                        setDateOpenId(null)
                      }}
                      onDeleteEntry={idx => deleteEntry(q.id, idx)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      {viewerQ && (
        <ProblemViewer questionId={viewerQ.id} title={viewerQ.title} onClose={() => setViewerQ(null)} />
      )}
      {showImport && (
        <ImportPanel userId={user.id} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
