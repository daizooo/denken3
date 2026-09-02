import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { BookOpen, Save, LogOut, Upload, Settings } from 'lucide-react'
import ProblemViewer from './components/ProblemViewer'
import ImportPanel from './components/ImportPanel'
import type { ExamId, ExamPlan, MockSession, Review, ReviewHistoryEntry, ReviewSnapshot, Status, StudyMode, Subject } from './domain/types'
import { EXAMS, DEFAULT_EXAM_ID, getExam, subjectNamesOf, chaptersOf, papersForSubject, subjectIdOf } from './data/registry'
import { addDaysStr, diffDays, formatMD, REVIEW_WINDOW_DAYS, toDateStr, todayJST } from './lib/date'
import { deriveFromHistory, defaultReview } from './lib/fsrs'
import { analyzePace, applicationReminder } from './lib/pace'
import { planPassTarget } from './lib/passTarget'
import { chapterWeaknessRanking, weeklyLearningCurve, quadrantMatrix, estimateScore } from './lib/analytics'
import { reviewValue, planDailyReviews } from './lib/reviewPlan'
import { buildTodaySummary } from './lib/todaySummary'
import {
  buildTimeStats, estimateMinutes, sumEstimateMinutes, planByBudget, valueDensity,
} from './lib/estimateMinutes'
import {
  startTimer, pauseTimer, resumeTimer, elapsedSeconds, durationCapSeconds,
  MAX_DURATION_SECONDS, type TimerState,
} from './lib/timer'
import {
  loadSnapshot, saveSnapshot, snapshotKey, queueWrite, pendingWrites, removeWrite, pendingCount,
} from './lib/offlineStore'
import { clearProblemImageCache, prefetchProblemImages } from './lib/problemImageCache'
import { STATUS_COLOR } from './features/shared/status'
import LoginScreen from './features/auth/LoginScreen'
import DashboardView from './features/dashboard/DashboardView'
import SettingsView from './features/settings/SettingsView'
import MockExamView from './features/mock-exam/MockExamView'
import QuestionCard from './features/questions/QuestionCard'
import FilterBar, { type ModeKey } from './features/questions/FilterBar'
import TodayPanel from './features/questions/TodayPanel'

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
  // オフライン対応（課題7・Phase F）。接続状態と、まだ送れていない記録の件数。
  const [online, setOnline]       = useState(() => navigator.onLine)
  const [pending, setPending]     = useState(0)
  // スタート画面は常に復習タブを表示する。
  const [activeTab, setActiveTab] = useState<'review' | 'list' | 'dashboard' | 'mock' | 'settings'>('review')
  const [selectedDate, setSelectedDate] = useState<string>(() => todayJST())
  // 対象資格（registry駆動・§7.8）。登録が1つの間は DEFAULT_EXAM_ID で固定。
  const [examId, setExamId]       = useState<ExamId>(DEFAULT_EXAM_ID)
  const [subject, setSubject]     = useState<Subject>(() => subjectNamesOf(DEFAULT_EXAM_ID)[0])
  const [chapterCode, setChapterCode] = useState('ALL')
  // 問題の絞り込み（学習場所 × 理解度）。軸間AND・軸内OR。空集合＝その軸は絞り込みなし。
  // セッション内のみの状態（永続化しない）。
  const [filterModes, setFilterModes] = useState<Set<ModeKey>>(() => new Set())
  const [filterStatuses, setFilterStatuses] = useState<Set<Status>>(() => new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  // 時間予算モード（課題1・提案B）。選択中の予算（分）。null＝指定なし。
  const [timeBudget, setTimeBudget] = useState<number | null>(null)
  // 「先の予定」（日付ストリップ）の開閉。既定は畳む（Phase H）。今日を見ている限り
  // 使わない行が常時1行を占有していたため。今日以外を選んでいる間は常に開く。
  const [datesOpen, setDatesOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMemo, setEditMemo]   = useState('')
  // 各問題の記録用「実施日」。未設定なら今日を使う。
  const [recordDate, setRecordDate] = useState<Record<string, string>>({})
  // 実施日ピッカーを開いている問題のID（通常は「今日」なので畳んでおく）
  const [dateOpenId, setDateOpenId] = useState<string | null>(null)
  // solving=true は「問題を解く」で開いた（解答時間を計測中の）状態。
  const [viewerQ, setViewerQ] = useState<{ id: string; title: string; solving: boolean } | null>(null)
  const [showImport, setShowImport] = useState(false)
  // 復習タブでこのセッション中に理解度を記録した問題。記録した瞬間に一覧から消すために使う。
  const [reviewedNowIds, setReviewedNowIds] = useState<Set<string>>(() => new Set())
  // 分野別の解答時間計測（§7.6）。「問題を解く」で開始、A/B/C で終了。
  // 問題IDごとの計測状態。UIの再描画とは無関係なので ref で保持する。
  const timersRef = useRef<Record<string, TimerState>>({})
  // 問題IDごとの記録上限秒（課題13）。難易度帯の中央値から算出するが、その中央値は
  // updateStatus より後で組み立てられるため、依存配列ではなく ref 経由で読む。
  const durationCapsRef = useRef<Record<string, number>>({})
  // reviews / plans が「どの対象（`${userId}:${examId}`）のデータか」。サーバ取得の成功と
  // オフライン用スナップショットの流し込みで更新する。取得済みの対象を古いキャッシュで
  // 上書きしない／別の資格のデータを取り違えて保存しない、の2つに使う（課題7）。
  const reviewsLoadedKeyRef = useRef<string | null>(null)
  const plansLoadedKeyRef = useRef<string | null>(null)
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
        // 先読みした問題画像も捨てる（端末を共有したときに前のユーザーの画像を残さない・課題7c）。
        void clearProblemImageCache()
        // 空になった状態をスナップショットとして書き戻さない（課題7）。
        reviewsLoadedKeyRef.current = null
        plansLoadedKeyRef.current = null
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
          reviewsLoadedKeyRef.current = snapshotKey(user.id, examId)
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
        plansLoadedKeyRef.current = snapshotKey(user.id, examId)
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

  // ---- オフライン対応（課題7・Phase F）----
  // 接続状態。ヘッダの表示と、記録を直接送るか送信待ちに積むかの判断に使う。
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // 起動時のハイドレート。サーバ取得を待たず、前回のスナップショットで即座に描画する
  // （service worker がシェルを返せても、学習データが無ければ画面は空になる）。
  // 取得の方が先に着いていた対象は上書きしない（スナップショットの方が古いため）。
  useEffect(() => {
    if (!user) return
    const key = snapshotKey(user.id, examId)
    let alive = true
    loadSnapshot(key).then(snap => {
      if (!alive || !snap) return
      if (reviewsLoadedKeyRef.current !== key) {
        setReviews(snap.reviews)
        reviewsLoadedKeyRef.current = key
      }
      if (plansLoadedKeyRef.current !== key) {
        setPlans(snap.plans)
        plansLoadedKeyRef.current = key
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [user, examId])

  // スナップショットの更新。取得直後だけでなくローカルの記録でも書き戻すので、
  // オフラインで付けた記録も次回起動時にそのまま見える。
  // まだこの対象のデータが入っていない間（資格の切り替え直後・取得失敗中）は書かない。
  useEffect(() => {
    if (!user) return
    const key = snapshotKey(user.id, examId)
    if (reviewsLoadedKeyRef.current !== key) return
    saveSnapshot(key, { reviews, plans })
  }, [user, examId, reviews, plans])

  // 送信待ちの掃き出し。起動時とオンライン復帰時に古い順で送る。
  // 1件でも失敗したらそこで止める（順序を保ったまま次の機会へ持ち越す）。
  // オフラインで起動したときも、前回の積み残し件数はヘッダに出す（送信は復帰時）。
  const flushOutbox = useCallback(async () => {
    if (!user) return
    if (navigator.onLine) {
      for (const w of await pendingWrites()) {
        const { error } = await supabase.from('denken_reviews').upsert(w.row)
        if (error) break
        await removeWrite(w.key)
      }
    }
    setPending(await pendingCount())
  }, [user])

  useEffect(() => {
    if (!user) return
    flushOutbox()
    window.addEventListener('online', flushOutbox)
    return () => window.removeEventListener('online', flushOutbox)
  }, [user, flushOutbox])

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
  // 学習データも空に戻す。オフラインで取得に失敗したとき、前の資格の記録が
  // そのまま残って見えてしまうのを防ぐ（課題7）。
  useEffect(() => {
    setSubject(subjectNamesOf(examId)[0])
    setChapterCode('ALL')
    setReviews({})
    setPlans({})
  }, [examId])

  // ---- 共通: Review を1件保存（ローカル即時反映＋DB upsert）----
  // オフライン／送信失敗時は送信待ちに積む（課題7d）。ローカルの状態とスナップショットは
  // 先に更新済みなので、画面上は成功と区別なく進み、復帰時に自動で送られる。
  const saveReview = useCallback(async (updated: Review) => {
    if (!user) return
    setReviews(prev => ({ ...prev, [updated.question_id]: updated }))
    const row = { user_id: user.id, exam_id: examId, ...updated }
    const outboxKey = `${user.id}:${examId}:${updated.question_id}`
    if (!navigator.onLine) {
      await queueWrite(outboxKey, row)
      setPending(await pendingCount())
      return
    }
    setSaving(true)
    const { error } = await supabase.from('denken_reviews').upsert(row)
    if (error) {
      console.error(error)
      await queueWrite(outboxKey, row)
      setPending(await pendingCount())
    }
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
    // 解答時間（分野別・§7.6）: 「問題を解く」で開始した計測があれば秒数を付与する。
    // 無効（日跨ぎ・上限超・未計測）なら duration_seconds を付けない＝計測前扱い。
    // 上限はその難易度帯の中央値の3倍と15分の小さいほう（課題13）。中断の混入を防ぐ。
    const entry: ReviewHistoryEntry = { date, status, prev: snapshotOf(current) }
    const timer = timersRef.current[questionId]
    if (timer) {
      const cap = durationCapsRef.current[questionId] ?? MAX_DURATION_SECONDS
      const sec = elapsedSeconds(timer, todayStr, Date.now(), cap)
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
  // 保存経路は saveReview に一本化する（オフライン時の送信待ちもそのまま効く・課題7d）。
  const saveDetails = useCallback(async (questionId: string) => {
    if (!user) return
    const current = reviews[questionId] ?? defaultReview(questionId)
    await saveReview({ ...current, memo: editMemo })
    setEditingId(null)
  }, [user, reviews, editMemo, saveReview])

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

  // S（復習不要）にした問題を、いつでも復習に戻す。
  // 学習履歴・FSRS状態はそのままに、次回復習日を今日へ設定して復習キューへ戻すだけ。
  // 再び A・B・C で採点すれば、温存された stability からスケジューリングが再開する。
  const reactivateReview = useCallback((questionId: string) => {
    const current = reviews[questionId]
    if (!current) return
    saveReview({ ...current, due_date: todayStr })
  }, [reviews, saveReview, todayStr])

  // ---- 絞り込み（学習場所 × 理解度）のトグル ----
  const toggleFilterMode = useCallback((m: ModeKey) => {
    setFilterModes(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      return next
    })
  }, [])
  const toggleFilterStatus = useCallback((s: Status) => {
    setFilterStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }, [])
  const clearFilters = useCallback(() => {
    setFilterModes(new Set())
    setFilterStatuses(new Set())
  }, [])

  // 弱点ランキング・学習曲線（§7.7(2)(3)）。ペース分析は合格ライン目標を使うため後段。
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
  // 所要時間の推定に使う実測統計（課題1・提案A）。難易度×studyMode の中央値と問題別の実測。
  const timeStats = useMemo(
    () => buildTimeStats(inputChapters, reviews),
    [inputChapters, reviews]
  )

  // 記録時の解答時間の上限（課題13）。難易度帯の中央値の3倍と15分の小さいほう。
  // 中断（画面を消さずに端末を置くと visibilitychange が発火しない）が解答時間として
  // 記録されるのを防ぐ。updateStatus からは ref 経由で読む。
  useEffect(() => {
    const caps: Record<string, number> = {}
    for (const c of currentChapters) {
      for (const q of c.questions) caps[q.id] = durationCapSeconds(quadrant.medians[q.difficulty])
    }
    durationCapsRef.current = caps
  }, [currentChapters, quadrant])
  const subjectSessions = useMemo(
    () => mockSessions.filter(s => s.subject_id === subjectIdOf(examId, subject)),
    [mockSessions, examId, subject]
  )
  const scoreEstimate = useMemo(
    () => estimateScore(currentChapters, reviews, subjectSessions, passingScore),
    [currentChapters, reviews, subjectSessions, passingScore]
  )

  // 合格ライン目標（課題2）。想定得点から「合格に必要な最小の問題集合」を逆算する。
  const passTarget = useMemo(
    () => planPassTarget(currentChapters, reviews, scoreEstimate),
    [currentChapters, reviews, scoreEstimate]
  )

  // 適応型ペース分析（§7.2）。ゴールの既定は「合格ライン到達」で、達成したら
  // 「全問A以上」へ自動昇格する（§6-1）。440問すべてA以上を分母にすると、
  // 学習時間が逼迫した状況では到達不能な目標に対して毎日 behind と判定されるため。
  const paceResult = useMemo(
    () => analyzePace(
      subjectQuestions, reviews, currentPlan, todayStr,
      passTarget.achieved
        ? { mode: 'mastery', remainingQ: passTarget.masteryRemainingQ }
        : { mode: 'pass', remainingQ: passTarget.requiredQ },
    ),
    [subjectQuestions, reviews, currentPlan, todayStr, passTarget]
  )

  // 「今日の学習」の新規着手枠（課題3）。復習due だけの画面だと、5分の隙間に開いて
  // 「今日の復習はありません」と出た日に、ユーザーが自分でタブを移動して絞り込みを
  // 開く必要がある。その操作こそが隙間時間を食うので、新規着手候補も同じキューに載せる。
  //
  // 枠数＝推奨ノルマ − 今日すでに着手した数（記録するたびに枠が減り、やがて空になる。
  // 補充し続けると「今日の分が終わった」状態に到達できない）。
  // 章フィルタに依らず科目全体で決めるので、章チップの件数と表示件数が食い違わない。
  const todayNew = useMemo(() => {
    const subjectQs = currentChapters.flatMap(c => c.questions)
    const startedToday = subjectQs.filter(q => reviews[q.id]?.first_reviewed === todayStr).length
    const slots = Math.max(0, paceResult.recommendedNorm - startedToday)
    const ids = new Set<string>()
    const picked: typeof subjectQs = []
    for (const q of subjectQs) {
      if (picked.length >= slots) break
      const r = reviews[q.id]
      if (r?.due_date) continue                  // 復習キューに載っている＝新規ではない
      if (r && r.status !== '未着手') continue   // S（復習不要）も対象外
      ids.add(q.id)
      picked.push(q)
    }
    return { ids, count: picked.length, minutes: sumEstimateMinutes(picked, reviews, timeStats) }
  }, [currentChapters, reviews, paceResult.recommendedNorm, todayStr, timeStats])

  // 問題画像の先読み（課題7c・Phase F）。今日のキュー（復習due＋新規着手枠）の画像を
  // オンラインのうちに Cache Storage へ置いておく。電波が弱い場面こそが隙間時間なので、
  // 「開いてから待つ」をなくす。鍵は storage_path（署名URLは TTL 3600秒で毎回変わるため
  // 鍵にできない・§9.4）。実処理と上限は lib/problemImageCache.ts。
  const todayImageIds = useMemo(() => {
    const qs = currentChapters.flatMap(c => c.questions)
    return qs
      .filter(q => {
        const due = reviews[q.id]?.due_date
        return todayNew.ids.has(q.id) || !!(due && due <= todayStr)
      })
      .map(q => q.id)
  }, [currentChapters, reviews, todayNew, todayStr])

  useEffect(() => {
    if (!user || !online) return
    return prefetchProblemImages(todayImageIds)
  }, [user, online, todayImageIds])

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
        // 今日は復習due＋新規着手枠（課題3）。表示件数と一致させる。
        if (i === 0) return !!(r?.due_date && r.due_date <= dStr) || todayNew.ids.has(q.id)
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
  }, [allQuestions, reviews, todayNew])

  // 絞り込み前の母数（タブ・日付・復習キューのロジックだけを適用）。
  // 学習場所×理解度の絞り込みと、そのチップ件数（ファセット）は、この母数から導く。
  const baseQuestions = useMemo(() => {
    const today = todayJST()
    const overflowStart = addDaysStr(today, REVIEW_WINDOW_DAYS)
    return allQuestions.filter(q => {
      const r = reviews[q.id]
      if (activeTab === 'review') {
        // 記録した瞬間に「復習済み」として消す（次回復習日が更新される前でも即反映）。
        if (reviewedNowIds.has(q.id)) return false
        if (selectedDate === today) {
          // 今日は「復習due」＋「新規着手枠」を1つのキューにまとめる（課題3）。
          const isDue = r?.due_date && r.due_date <= today
          if (!isDue && !todayNew.ids.has(q.id)) return false
        } else if (selectedDate >= overflowStart) {
          // 「◯/◯以降」タブ: overflowStart 以降の予定をすべて表示
          if (!(r?.due_date && r.due_date >= overflowStart)) return false
        } else {
          if (!r?.due_date || r.due_date !== selectedDate) return false
        }
      }
      return true
    })
  }, [allQuestions, reviews, activeTab, selectedDate, reviewedNowIds, todayNew])

  // 絞り込み判定（軸内OR・空集合はその軸を素通し）。
  const matchMode = useCallback(
    (q: { studyMode?: StudyMode }) => filterModes.size === 0 || filterModes.has(q.studyMode ?? 'unset'),
    [filterModes]
  )
  const matchStatus = useCallback(
    (id: string) => filterStatuses.size === 0 || filterStatuses.has(reviews[id]?.status ?? '未着手'),
    [filterStatuses, reviews]
  )

  // チップの件数（ファセット）。各軸の件数は「他方の軸の選択」を尊重して数える。
  const filterCounts = useMemo(() => {
    const modeCounts = { calc: 0, memory: 0, unset: 0 } as Record<ModeKey, number>
    const statusCounts = { S: 0, A: 0, B: 0, C: 0, 未着手: 0 } as Record<Status, number>
    for (const q of baseQuestions) {
      const mk: ModeKey = q.studyMode ?? 'unset'
      const st: Status = reviews[q.id]?.status ?? '未着手'
      if (matchStatus(q.id)) modeCounts[mk]++
      if (matchMode(q)) statusCounts[st]++
    }
    return { modeCounts, statusCounts }
  }, [baseQuestions, reviews, matchMode, matchStatus])

  const filteredQuestions = useMemo(() => {
    const filtered = baseQuestions.filter(q => matchMode(q) && matchStatus(q.id))
    // 復習タブは「価値順」で並べる（reviewPlan.ts）。
    // 価値＝〔忘却リスク 1-R〕×〔理解度〕。いま忘れかけていて、理解度の低い問題ほど先に。
    // 同点は出題頻度→難易度で割る（課題11。重要度は83%が3の実質定数だったため外した）。
    if (activeTab !== 'review') return filtered
    // 並び順のキーは事前計算（比較の中で R を再計算しない）。
    // 時間予算モード（課題1・提案B）が有効な間は「価値 ÷ 推定所要分」の降順にする。
    // 時間が希少なときの最適な貪欲順は価値そのものではなく、単位時間あたりの期待得点の伸び。
    const rankOf = new Map<string, number>()
    const freqOf = new Map<string, number>()
    for (const q of filtered) {
      const v = reviewValue(q, reviews[q.id], todayStr, currentPlan?.exam_date ?? null)
      freqOf.set(q.id, v.frequency)
      rankOf.set(q.id, timeBudget === null
        ? v.score
        : valueDensity(v.score, estimateMinutes(q, reviews[q.id], timeStats)))
    }
    return [...filtered].sort((a, b) => {
      const va = rankOf.get(a.id) ?? 0, vb = rankOf.get(b.id) ?? 0
      if (va !== vb) return vb - va
      // 新規着手枠は価値スコア0（復習対象外）。ここで並べ替えず章の学習順を保つ（課題3）。
      if (va === 0 && vb === 0) return 0
      // 同じ価値なら、過去に多く出題された問題を先に（2回以上は全440問中80問・§8.4）。
      const fa = freqOf.get(a.id) ?? 0, fb = freqOf.get(b.id) ?? 0
      if (fa !== fb) return fb - fa
      if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty
      return 0
    })
  }, [baseQuestions, reviews, activeTab, matchMode, matchStatus, todayStr, timeBudget, timeStats, currentPlan])

  // 時間予算の線（課題1・提案B）。表示中のキューに対して、累積の推定所要が予算に達した
  // 位置を求める。予算未指定のときはキュー全体の推定所要だけを使う。
  const budgetPlan = useMemo(
    () => planByBudget(filteredQuestions, reviews, timeStats, timeBudget ?? Infinity),
    [filteredQuestions, reviews, timeStats, timeBudget]
  )

  // 今日の復習の「推奨ライン」（reviewPlan.ts）。上限で切るのではなく、価値順に並んだ
  // 今日の due 全体を「今日はここまで」で線引きするための位置。1日全体の概念なので、
  // チャプター/状態フィルタに依らず、科目内の today due 全体に対して算出する。
  const todayReviewPlan = useMemo(() => {
    const candidates = allQuestions
      .filter(q => {
        const r = reviews[q.id]
        return !!(r?.due_date && r.due_date <= todayStr)
      })
      .map(q => ({ question: q, review: reviews[q.id] }))
    const plan = planDailyReviews(candidates, todayStr, currentPlan?.exam_date ?? null)
    // 推奨ラインぶんの推定所要分（提案C）。「7問」が10分なのか70分なのかを併記する。
    const recommended = [...candidates]
      .sort((a, b) =>
        reviewValue(b.question, b.review, todayStr, currentPlan?.exam_date ?? null).score -
        reviewValue(a.question, a.review, todayStr, currentPlan?.exam_date ?? null).score)
      .slice(0, plan.recommendedCount)
      .map(c => c.question)
    return { ...plan, recommendedMinutes: sumEstimateMinutes(recommended, reviews, timeStats) }
  }, [allQuestions, reviews, todayStr, currentPlan, timeStats])

  // 今日の一手サマリ（課題9）。復習タブの最上部に出す1行ぶんの値を束ねる。
  // 分析タブを開かなくても「今日いくらやれば良いか・いまどこにいるか」が分かるようにする。
  // 今日すでに記録した問数（進捗バーの分子・Phase H）。todayReviewPlan と同じ母数
  // （allQuestions）から数え、「完了＋残り」が今日の総量として1本に閉じるようにする。
  const doneToday = useMemo(
    () => allQuestions.filter(q => reviews[q.id]?.last_reviewed === todayStr).length,
    [allQuestions, reviews, todayStr]
  )

  const todaySummary = useMemo(
    () => buildTodaySummary(todayReviewPlan, todayNew, scoreEstimate, passTarget, doneToday),
    [todayReviewPlan, todayNew, scoreEstimate, passTarget, doneToday]
  )

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
    const counts: Record<Status, number> = { S: 0, A: 0, B: 0, C: 0, '未着手': 0 }
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
  const masteredQ = allQuestions.filter(q => {
    const s = reviews[q.id]?.status
    return s === 'A' || s === 'S'
  }).length
  const overflowStart = addDaysStr(todayStr, REVIEW_WINDOW_DAYS)
  const reviewDueCount = (questions: { id: string }[]) =>
    questions.filter(q => {
      const r = reviews[q.id]
      if (selectedDate === todayStr) {
        // 今日の表示対象は「復習due＋新規着手枠」。ここを一致させないと
        // チップの件数と実際の表示件数が食い違う（課題3）。
        return !!(r?.due_date && r.due_date <= todayStr) || todayNew.ids.has(q.id)
      }
      if (selectedDate >= overflowStart) {
        return !!(r?.due_date && r.due_date >= overflowStart)
      }
      return r?.due_date === selectedDate
    }).length
  // 新規着手枠の見出しに出す件数（課題3）。新規着手枠は科目全体で決まるが、
  // ここは表示中（章フィルタ後）の件数に合わせる。
  const todayNewShown = allQuestions.filter(q => todayNew.ids.has(q.id)).length
  // 復習due と新規着手枠の境界（課題3）。新規着手枠は価値スコア0でキュー末尾に並ぶため、
  // 最初に現れる新規着手枠の位置がそのまま区切りになる（-1＝新規なし）。
  const newStartIdx = activeTab === 'review' && selectedDate === todayStr
    ? filteredQuestions.findIndex(q => todayNew.ids.has(q.id))
    : -1
  const dueShownCount = newStartIdx === -1 ? filteredQuestions.length : newStartIdx
  const isTodayView = selectedDate === todayStr
  // 章セレクトの選択肢（Phase H。旧: 本文上のチップ10個）。件数の意味はタブで変わる
  // （復習タブ＝表示中の日付の件数 / 全問題タブ＝収録数）ので、そこは従来どおり。
  const chapterOptions = [
    { code: 'ALL', label: `全章（${activeTab === 'review' ? reviewDueCount(allQuestions) : totalQ}問）` },
    ...inputChapters.map(c => ({
      code: c.code,
      label: `${c.name}（${activeTab === 'review' ? reviewDueCount(c.questions) : c.questions.length}）`,
    })),
    ...currentChapters.filter(c => c.questions.length === 0).map(c => ({
      code: c.code, label: `${c.name}（未入力）`, disabled: true,
    })),
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* ===== HEADER ===== */}
        <header className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <BookOpen size={18} className="text-blue-600 shrink-0" />
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
                <span className="flex items-baseline gap-1.5">
                  <span className="font-bold text-gray-800 text-base whitespace-nowrap">ElectricPro</span>
                  {/* 資格名は狭い画面では出さない（科目セレクトが文脈を持つため）。 */}
                  <span className="hidden sm:inline text-xs font-medium text-gray-500 whitespace-nowrap">{exam.name}</span>
                </span>
              )}
              {/* 科目（Phase H）。旧: 全幅4分割のタブ1行。切り替え頻度が低く、常時1行を
                  占有する必要がないため、資格名の隣のセレクトに畳んだ。 */}
              <select
                value={subject}
                onChange={e => { setSubject(e.target.value as Subject); setChapterCode('ALL') }}
                title="科目の切り替え"
                className="text-xs font-medium text-gray-700 bg-gray-100 border-none rounded-md px-1.5 py-1 cursor-pointer focus:outline-none"
              >
                {subjects.map(sub => {
                  const count = chapters.filter(c => c.subject === sub)
                    .reduce((sum, c) => sum + c.questions.length, 0)
                  return (
                    <option key={sub} value={sub}>{sub}{count > 0 ? `（${count}）` : ''}</option>
                  )
                })}
              </select>
              {daysToExam !== null && daysToExam >= 0 && (
                <span
                  className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap"
                  title={`${subject}試験まで あと${daysToExam}日`}
                >
                  あと{daysToExam}日
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2 shrink-0 ml-auto">
              {/* オフライン表示（課題7）。記録は送信待ちに積まれ、復帰時に自動で送られるので
                  「使えない」ではなく「あとで送る」ことが分かる文言にする。 */}
              {(!online || pending > 0) && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    online ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}
                  title={online ? '未送信の記録があります（自動で送信します）' : 'オフラインです。記録は復帰時に自動で送信します'}
                >
                  {online ? `未送信${pending}件` : `オフライン${pending > 0 ? `・未送信${pending}件` : ''}`}
                </span>
              )}
              {/* 学習量の要約はここに出さない（Phase H）。今日パネルと同じ値の重複表示が
                  「今日は39問なのか109問なのか」を読めなくしていたため、指標は1箇所に寄せた。 */}
              {saving && (
                <span className="flex items-center gap-1">
                  <Save size={12} className="animate-pulse text-blue-400" />
                  保存中...
                </span>
              )}
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

          {/* 表示タブ */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {/* 「今日」だと日付ストリップの「今日」列と紛らわしいので、タブは中身
                  （復習キュー）で呼ぶ。バッジは今日の推奨件数＝パネルの主数値と一致。 */}
              復習{todaySummary.remainingCount > 0 ? ` (${todaySummary.remainingCount})` : ''}
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
            passTarget={passTarget}
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
            {/* ===== 今日パネル（Phase H）: 復習タブのみ =====
                旧: 今日の一手バー ＋ 章チップ（折り返し2行）＋ 日付ストリップ ＋ 時間予算バー
                の4面。同じ数値が3組重複していたため、1枚に統合した。章は絞り込みへ移動。 */}
            {activeTab === 'review' && (
              <TodayPanel
                summary={todaySummary}
                isToday={isTodayView}
                dateLabel={formatMD(selectedDate)}
                queueCount={filteredQuestions.length}
                queueMinutes={budgetPlan.totalMinutes}
                budget={timeBudget}
                onBudgetChange={setTimeBudget}
                fitCount={budgetPlan.count}
                fitMinutes={budgetPlan.minutes}
                dates={reviewSchedule}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                // 今日以外を見ている間は畳めない（今日へ戻る導線がこの列しかないため）。
                datesOpen={datesOpen || !isTodayView}
                onToggleDates={() => setDatesOpen(o => !o)}
              />
            )}

            {/* ===== 絞り込み（学習場所 × 理解度）: 復習・一覧の両タブ ===== */}
            <FilterBar
              modes={filterModes}
              statuses={filterStatuses}
              onToggleMode={toggleFilterMode}
              onToggleStatus={toggleFilterStatus}
              onClear={clearFilters}
              modeCounts={filterCounts.modeCounts}
              statusCounts={filterCounts.statusCounts}
              open={filterOpen}
              onToggleOpen={() => setFilterOpen(o => !o)}
              chapterCode={chapterCode}
              onChangeChapter={setChapterCode}
              chapterOptions={chapterOptions}
            />

            {/* ===== QUESTION LIST ===== */}
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                {(filterModes.size > 0 || filterStatuses.size > 0) && baseQuestions.length > 0 ? (
                  <>
                    <p className="text-gray-400 text-sm">絞り込み条件に一致する問題がありません</p>
                    <button
                      onClick={clearFilters}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                    >絞り込みをクリア</button>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">
                    {activeTab === 'review'
                      ? reviewedNowIds.size > 0
                        ? '🎉 今日の分を完了しました'
                        : selectedDate === todayJST()
                          ? '今日やることはありません'
                          : 'この日の復習予定はありません'
                      : '表示できる問題がありません'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map((q, idx) => {
                  const review = reviews[q.id] ?? defaultReview(q.id)
                  const isEditing = editingId === q.id
                  // 今日の推奨ラインの区切り（reviewPlan.ts）。ここから下は"遅延"ではなく順番待ち。
                  // 1日全体の概念なので、今日タブ・全章・全状態を表示中のときだけ線を引く。
                  const showLine =
                    activeTab === 'review' &&
                    timeBudget === null &&
                    selectedDate === todayStr &&
                    chapterCode === 'ALL' &&
                    filterModes.size === 0 &&
                    filterStatuses.size === 0 &&
                    idx === todayReviewPlan.recommendedCount &&
                    todayReviewPlan.recommendedCount < dueShownCount

                  // 時間予算の線（課題1・提案B）。推奨ラインの一般化なので、予算を選んでいる
                  // 間はこちらに置き換える。表示中のキューに対して引くため絞り込みは問わない。
                  const showBudgetLine =
                    activeTab === 'review' &&
                    timeBudget !== null &&
                    idx === budgetPlan.count &&
                    budgetPlan.count < filteredQuestions.length

                  // 復習と新規着手の区切り（課題3）。小見出し1行だけで示す。
                  const showNewHeading = newStartIdx >= 0 && idx === newStartIdx

                  return (
                    <Fragment key={q.id}>
                    {showLine && (
                      <div className="flex items-center gap-2 py-1 select-none">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          ここまでが今日の推奨 · 以降は順番待ち（遅れではありません）
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    {showBudgetLine && (
                      <div className="flex items-center gap-2 py-1 select-none">
                        <div className="flex-1 h-px bg-blue-200" />
                        <span className="text-[11px] text-blue-500 whitespace-nowrap">
                          ここまでが{timeBudget}分ぶん · 以降は次の隙間で
                        </span>
                        <div className="flex-1 h-px bg-blue-200" />
                      </div>
                    )}
                    {showNewHeading && (
                      <div className="flex items-center gap-2 py-1 select-none">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          ここから新規着手 {todayNewShown}問（今日のノルマ）
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    <QuestionCard
                      q={q}
                      review={review}
                      activeTab={activeTab}
                      todayStr={todayStr}
                      examDate={currentPlan?.exam_date ?? null}
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
                      onReactivate={() => reactivateReview(q.id)}
                      onViewProblem={() => {
                        // 「問題を見る」= 確認のみ。タイマーは動かさない。
                        // 計測中の状態が残っていると解答時間に混ざるので破棄する。
                        delete timersRef.current[q.id]
                        setViewerQ({ id: q.id, title: `${q.chapterName} 問${q.number}　${q.title}`, solving: false })
                      }}
                      onSolveProblem={() => {
                        // 「問題を解く」= 解答時間の計測開始（§7.6）。A/B/C 押下時に秒数を確定する。
                        timersRef.current[q.id] = startTimer(todayStr)
                        setViewerQ({ id: q.id, title: `${q.chapterName} 問${q.number}　${q.title}`, solving: true })
                      }}
                      dateValue={dateFor(q.id)}
                      dateOpen={dateOpenId === q.id}
                      onOpenDate={() => setDateOpenId(q.id)}
                      onDateChange={v => setRecordDate(prev => ({ ...prev, [q.id]: v }))}
                      onResetDate={() => {
                        setRecordDate(prev => { const next = { ...prev }; delete next[q.id]; return next })
                        setDateOpenId(null)
                      }}
                      onDeleteEntry={i => deleteEntry(q.id, i)}
                    />
                    </Fragment>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      {viewerQ && (
        <ProblemViewer
          questionId={viewerQ.id}
          title={viewerQ.title}
          solving={viewerQ.solving}
          onClose={() => setViewerQ(null)}
          // 解いた直後にこの画面から記録して閉じる（課題8）。カードを探し直す視線移動をなくす。
          onRecord={s => { void updateStatus(viewerQ.id, s); setViewerQ(null) }}
          // 中断（課題13）: 計測を破棄して閉じる。中断時間を解答時間に混ぜない。
          onAbort={() => { delete timersRef.current[viewerQ.id]; setViewerQ(null) }}
        />
      )}
      {showImport && (
        <ImportPanel userId={user.id} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
