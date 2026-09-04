import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { BookOpen, Save, LogOut, Upload, Settings } from 'lucide-react'
import ProblemViewer from './components/ProblemViewer'
import ImportPanel from './components/ImportPanel'
import type { ExamId, ExamPlan, MockSession, Review, ReviewHistoryEntry, Status, StudyMode, Subject } from './domain/types'
import { EXAMS, DEFAULT_EXAM_ID, getExam, subjectNamesOf, chaptersOf, papersForSubject, subjectIdOf } from './data/registry'
import { addDaysStr, diffDays, formatMD, REVIEW_WINDOW_DAYS, toDateStr, todayJST } from './lib/date'
import { deriveFromHistory, defaultReview, finalCheckDue, RETENTION_DEFAULT } from './lib/fsrs'
import { analyzePace, applicationReminder } from './lib/pace'
import { planPassTarget, isEstimateValidated } from './lib/passTarget'
import { buildPlanAlert } from './lib/planAlert'
import { optimizePolicy, passMarginFor } from './lib/policy'
import { chapterWeaknessRanking, weeklyLearningCurve, quadrantMatrix, estimateScore } from './lib/analytics'
import { planToday, forwardSlotsToday, orderByDensity } from './lib/planToday'
import { buildTodaySummary } from './lib/todaySummary'
import { loadAdoptedParams, type FsrsParamsRow } from './lib/fsrsParams'
import {
  buildTimeStats, sumEstimateMinutes,
  type EstimateModeKey,
} from './lib/estimateMinutes'
import {
  startTimer, pauseTimer, resumeTimer, elapsedSeconds, durationCapSeconds,
  MAX_DURATION_SECONDS, type TimerState,
} from './lib/timer'
import {
  loadSnapshot, saveSnapshot, snapshotKey, queueWrite, pendingWrites, removeWrite, pendingCount,
} from './lib/offlineStore'
import { clearProblemImageCache, prefetchProblemImages } from './lib/problemImageCache'
import { isMeaningful, type Attempt } from './lib/attempt'
import { partCountFromTitle } from './lib/sourceLink'
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
  // 時間予算モード（課題1・提案B）。選択中の予算（分）。null＝指定なし（「すべて」）。
  // Phase B-2 で denken_settings へ永続化する（従来はリロードで消えていた・設計書 §1.1）。
  const [timeBudget, setTimeBudget] = useState<number | null>(null)
  // 採用中の FSRS パラメータ w[]（Phase D）。null＝既定パラメータ（版0）。
  // 記録時にこの版を履歴へ書き残すので、あとで別の版を採用しても過去の予定日は動かない。
  const [fsrsParams, setFsrsParams] = useState<FsrsParamsRow | null>(null)
  // パラメータの読み込みが済んだか。復習の取得はこれを待つ（忘却曲線が w[] に依存するため）。
  const [fsrsParamsReady, setFsrsParamsReady] = useState(false)
  // 採用直後にパラメータと復習を作り直すためのキー。進めると両方が再取得される。
  const [fsrsReloadKey, setFsrsReloadKey] = useState(0)
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
  const [viewerQ, setViewerQ] = useState<
    { id: string; title: string; solving: boolean; partCount: 1 | 2 } | null
  >(null)
  const [showImport, setShowImport] = useState(false)
  // 復習タブでこのセッション中に理解度を記録した問題。記録した瞬間に一覧から消すために使う。
  const [reviewedNowIds, setReviewedNowIds] = useState<Set<string>>(() => new Set())
  // 分野別の解答時間計測（§7.6）。「問題を解く」で開始、A/B/C で終了。
  // 問題IDごとの計測状態。UIの再描画とは無関係なので ref で保持する。
  const timersRef = useRef<Record<string, TimerState>>({})
  // 問題IDごとの記録上限秒（課題13）。難易度帯の中央値から算出するが、その中央値は
  // updateStatus より後で組み立てられるため、依存配列ではなく ref 経由で読む。
  const durationCapsRef = useRef<Record<string, number>>({})
  // 記録時に適用する目標保持率を返す関数（Phase C-1・設計書 §3.4）。
  // policy は reviews が変わるたび作り直されるので、updateStatus の依存配列に入れると
  // 記録ハンドラの同一性が毎回変わる。durationCapsRef と同じく ref 経由で読む。
  const retentionOfRef = useRef<(id: string) => number>(() => RETENTION_DEFAULT)
  // 記録時に書き残す w[] の版。retentionOfRef と同じ理由で ref から読む
  // （記録ハンドラの同一性を、採用の有無で変えないため）。
  const wVersionRef = useRef<number | undefined>(undefined)
  // reviews / plans が「どの対象（`${userId}:${examId}`）のデータか」。サーバ取得の成功と
  // オフライン用スナップショットの流し込みで更新する。取得済みの対象を古いキャッシュで
  // 上書きしない／別の資格のデータを取り違えて保存しない、の2つに使う（課題7）。
  const reviewsLoadedKeyRef = useRef<string | null>(null)
  const plansLoadedKeyRef = useRef<string | null>(null)
  // 設定（時間予算）の読み込みが終わったか（Phase B-2）。読み込み前に保存すると、
  // 初期値 null を書き戻して他端末で選んだ予算を消してしまうため、保存の門にする。
  const settingsLoadedRef = useRef(false)
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
  // FSRS パラメータ（Phase D）の読み込みを待ってから走らせる。忘却曲線は w[] に依存する
  // ので、版が登録される前に一覧を組むと、リスク帯だけが別の曲線で判定された状態になる。
  // fsrsReloadKey を進めると ready が一度 false に戻るため、採用直後の再取得もここを通る。
  useEffect(() => {
    if (!user || !fsrsParamsReady) return
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
  }, [user, examId, fsrsParamsReady])

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

  // ---- Fetch settings（時間予算・Phase B-2）----
  // 従来 timeBudget は useState だけに存在し、リロードで消えていた（設計書 §1.1）。
  // 端末をまたいで同じ予算で今日のラインが引かれるよう denken_settings に置く。
  useEffect(() => {
    settingsLoadedRef.current = false
    if (!user) return
    supabase
      .from('denken_settings')
      .select('time_budget_minutes')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setTimeBudget(data?.time_budget_minutes ?? null)
        settingsLoadedRef.current = true
      })
  }, [user])

  // ---- Fetch FSRS パラメータ（採用中の版・Phase D）----
  // 読めなくても既定パラメータで動くので、起動を止める理由にはしない
  // （履歴に刻まれた版は fsrs.ts 側で既定へフォールバックする）。
  const reloadFsrsParams = useCallback(() => setFsrsReloadKey(k => k + 1), [])

  useEffect(() => {
    if (!user) { setFsrsParamsReady(false); return }
    setFsrsParamsReady(false)
    let cancelled = false
    void loadAdoptedParams(user.id, examId)
      .then(row => {
        if (cancelled) return
        setFsrsParams(row)
        wVersionRef.current = row?.version
      })
      .catch(e => console.error(e))
      // 成否に関わらず ready を立てる。ここで止めると、オフラインや一時的な失敗で
      // **復習一覧そのものが読み込まれない**。読めなければ既定パラメータで動けばよい。
      .finally(() => { if (!cancelled) setFsrsParamsReady(true) })
    return () => { cancelled = true }
  }, [user, examId, fsrsReloadKey])

  // 時間予算の変更（即時保存）。失敗しても画面の選択は保つ（次の変更で再送される）。
  const changeTimeBudget = useCallback((minutes: number | null) => {
    setTimeBudget(minutes)
    if (!user || !settingsLoadedRef.current) return
    void supabase
      .from('denken_settings')
      .upsert({ user_id: user.id, time_budget_minutes: minutes })
      .then(({ error }) => { if (error) console.error(error) })
  }, [user])

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

  // ---- 実施日 + 理解度を記録（履歴に蓄積）----
  // attempt: 解答前コミットの観測値（Phase 1）。ProblemViewer から渡される。
  const updateStatus = useCallback(async (
    questionId: string, status: Status, attempt?: Attempt,
  ) => {
    if (!user || status === '未着手') return
    const current = reviews[questionId] ?? defaultReview(questionId)
    const date = dateFor(questionId)
    // 解答時間（分野別・§7.6）: 「問題を解く」で開始した計測があれば秒数を付与する。
    // 無効（日跨ぎ・上限超・未計測）なら duration_seconds を付けない＝計測前扱い。
    // 上限はその難易度帯の中央値の3倍と15分の小さいほう（課題13）。中断の混入を防ぐ。
    const entry: ReviewHistoryEntry = { date, status }
    // その記録に適用した目標保持率を書き残す（Phase C-1・設計書 §3.4）。
    // これがあるので、ポリシーが明日変わっても deriveFromHistory の再生結果は変わらない。
    // 書き残さずに層3を効かせると、過去の予定日が毎日書き換わる（§6 の禁止事項）。
    // w[] の版も同じ器へ入れる。保持率と同じく「この記録は何で計算されたか」を残すため。
    entry.policy = {
      retention: retentionOfRef.current(questionId),
      ...(wVersionRef.current ? { w_version: wVersionRef.current } : {}),
    }
    // 未選択のまま閉じた等、情報の無い試行は履歴に残さない。
    if (isMeaningful(attempt)) entry.attempt = attempt
    const timer = timersRef.current[questionId]
    if (timer) {
      const cap = durationCapsRef.current[questionId] ?? MAX_DURATION_SECONDS
      const sec = elapsedSeconds(timer, todayStr, Date.now(), cap)
      if (sec !== undefined) entry.duration_seconds = sec
      delete timersRef.current[questionId]
    }
    const history: ReviewHistoryEntry[] = [...(current.review_history ?? []), entry]
    // 復習タブでは、記録した問題を「復習済み」として即座に一覧から消す。
    if (activeTab === 'review') {
      setReviewedNowIds(prev => new Set(prev).add(questionId))
    }
    await persistReview(current, history)
  }, [user, reviews, persistReview, recordDate, activeTab, todayStr])

  // ---- 履歴エントリを取り消し（誤記録の修正用）----
  // review_history は常に実施日順で保存されるため、index はそのまま時系列順。
  // 残った履歴を再生し直すだけ（deriveFromHistory）。削除位置による分岐は無い。
  //
  // 【なぜスナップショット（旧 ReviewHistoryEntry.prev）をやめたか】
  // かつては末尾の取消だけ「記録直前スナップショット」へ巻き戻していた。アルゴリズムが
  // 変わっても記録前の予定日に確実に戻す、という意図だったが、Phase C で記録時の保持率を
  // 履歴へ書き残す仕組み（entry.policy.retention）が入り、再生そのものが決定的になった
  // ため、役割が重複していた。
  //
  // 重複は無害ではなかった。本番データで両者を突き合わせると、stability・理解度は完全に
  // 一致する一方、**予定日だけが系統的にズレていた**（例 ac1_11: 再生 8/03 / スナップ 7/30)。
  // スナップショットは目標保持率 0.9 時代に書かれた値で、その後 0.85 へ変えたときに
  // 追随していない。つまり同じカードの「記録前の状態」が2通りDBに存在し、
  // **末尾を消すか途中を消すかで違う答えが返る**状態だった。
  // 消すべきは古いほうで、残すべきは全経路が通る再生のほうである。
  const deleteEntry = useCallback(async (questionId: string, index: number) => {
    if (!user) return
    const current = reviews[questionId]
    if (!current) return
    await persistReview(current, current.review_history.filter((_, i) => i !== index))
  }, [user, reviews, persistReview])

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

  // 試験日を設定・変更したとき、S（復習不要）の試験前最終確認を張り直す（Phase 0）。
  // S は due_date=null で復習キューに出ないため、記録の機会が来ず deriveFromHistory による
  // 自己修復が起きない。試験日が無い状態で S を付けた問題が、後から試験日を入れても
  // 永久に最終確認へ戻らないのを防ぐ（migration 015 と同じ是正をアプリ側でも行う）。
  const refreshFinalChecks = useCallback((examDate: string | null) => {
    const due = finalCheckDue(todayStr, examDate)
    if (!due) return
    for (const r of Object.values(reviews)) {
      if (r.status === 'S' && !r.due_date) void saveReview({ ...r, due_date: due })
    }
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

  // 安全マージン（adaptive-fsrs-policy.md §3.3 層1・Phase C-4）。
  //
  // 従来は passTarget.DEFAULT_PASS_MARGIN の固定10点だった。「合格を確実に」するなら、
  // **推定が信用できないほどマージンを厚くする**のが正しい（原則 §0）。CBT実測が無い間は
  // 最大側の15点＝目標75点を採り、実測2回以上で較正できたら「想定が実測よりどれだけ
  // 甘かったか」の分だけ上乗せする（最小8点）。下げるのは検証できたときだけ。
  //
  // これは目標を**上げる**方向の自動化である。requiredQ が増えて必要ペースも上がるが、
  // それは要求3（合格ライン＋αは厳守）に沿った増やし方であり、妥協ではない。
  // Phase A で policy.targetScore はこの値を既に表示していたため、設定タブの「目標得点
  // 75点」と分析タブの「目標 70点」が食い違っていた。ここで出所を1つに揃える。
  const passMargin = useMemo(
    () => passMarginFor(scoreEstimate, subjectSessions),
    [scoreEstimate, subjectSessions]
  )

  // 合格ライン目標（課題2）。想定得点から「合格に必要な最小の問題集合」を逆算する。
  const passTarget = useMemo(
    () => planPassTarget(currentChapters, reviews, scoreEstimate, passMargin),
    [currentChapters, reviews, scoreEstimate, passMargin]
  )

  // 適応型ポリシー（adaptive-fsrs-policy.md Phase A）。
  // Phase A では**値を算出して設定タブに表示するだけ**で、FSRS のスケジューリングにも
  // 今日のキューにも流さない。画面に出ていない値は自動で動かさない、という順序のため。
  const policy = useMemo(
    () => optimizePolicy({
      chapters: currentChapters,
      reviews,
      scoreEstimate,
      passTarget,
      sessions: subjectSessions,
      timeStats,
      today: todayStr,
      examDate: currentPlan?.exam_date ?? null,
      bunyaTargetDate: currentPlan?.bunya_target_date ?? null,
    }),
    [currentChapters, reviews, scoreEstimate, passTarget, subjectSessions, timeStats, todayStr, currentPlan]
  )

  // ポリシーが決めた目標保持率を、記録ハンドラから読めるようにする（Phase C-1）。
  // 層3（コア 0.90 ／ バッファ 計算 0.85・暗記 0.80、直前期は 0.90 下限）が、ここで初めて
  // 実際のスケジューリングへ流れる。流す条件だった「適用値を履歴へ書き残す」（§3.4）は
  // updateStatus 側で満たしている。
  useEffect(() => {
    const modeOf = new Map<string, EstimateModeKey>()
    for (const c of currentChapters) {
      for (const q of c.questions) modeOf.set(q.id, q.studyMode ?? 'unset')
    }
    retentionOfRef.current = id => policy.retentionOf(id, modeOf.get(id) ?? 'unset')
  }, [policy, currentChapters])

  // 適応型ペース分析（§7.2）。
  //
  // ゴールの既定は「全範囲を A 以上」＝最も安全な側に置く（adaptive-fsrs-policy.md §2 訂正）。
  // 「合格に必要な最小集合」（pass モード）は、想定得点モデルが正しい前提で学習量を
  // 減らす仕組みなので、そのモデルが CBT 実測で検証されるまでは使わない。
  // 検証前に効かせると、未検証の楽観的な推定がそのまま「やらなくてよい」に化ける。
  //
  // 課題2（440問すべてA以上だと毎日 behind と判定される）への対処は、
  // ゴールを下げることではなく進捗の見せ方で行う（Phase A / B）。
  const goalValidated = useMemo(() => isEstimateValidated(subjectSessions), [subjectSessions])
  const paceResult = useMemo(
    () => analyzePace(
      subjectQuestions, reviews, currentPlan, todayStr,
      goalValidated && !passTarget.achieved
        ? { mode: 'pass', remainingQ: passTarget.requiredQ }
        : { mode: 'mastery', remainingQ: passTarget.masteryRemainingQ },
    ),
    [subjectQuestions, reviews, currentPlan, todayStr, passTarget, goalValidated]
  )

  // 「今日の学習」の新規着手枠（課題3）。復習due だけの画面だと、5分の隙間に開いて
  // 「今日の復習はありません」と出た日に、ユーザーが自分でタブを移動して絞り込みを
  // 開く必要がある。その操作こそが隙間時間を食うので、新規着手候補も同じキューに載せる。
  //
  // 枠数＝今日の前進枠 − 今日すでに着手した数（記録するたびに枠が減り、やがて空になる。
  // 補充し続けると「今日の分が終わった」状態に到達できない）。
  // 章フィルタに依らず科目全体で決めるので、章チップの件数と表示件数が食い違わない。
  //
  // 【Phase B-1】枠数の根拠を pace.recommendedNorm からポリシーへ移した。
  // recommendedNorm は clamp(必要ペース, 現在ペース×0.8, 現在ペース×1.3) で決まるため、
  // 停止が続いて現在ペースが 0 に近づくと枠も 0 へ張り付く（設計書 §3.1）。
  // 「勉強できないから要求を下げる」という利用者が明確に禁止した挙動そのものなので、
  // 今日の枠は現在ペースを見ず「残り ÷ 残り日数」だけから決める（forwardSlotsToday）。
  const todayNew = useMemo(() => {
    const subjectQs = currentChapters.flatMap(c => c.questions)
    const startedToday = subjectQs.filter(q => reviews[q.id]?.first_reviewed === todayStr).length
    const slots = forwardSlotsToday(policy, startedToday)
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
  }, [currentChapters, reviews, policy, todayStr, timeStats])

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

  // 今日のライン（planToday.ts・Phase B-1）。
  //
  // 旧 planDailyReviews は締切からの逆算 ceil(due総数 ÷ catchUpDays) だけで決めており、
  // 14日停止から復帰した日に「今日36問・約4時間」の崖が立っていた（設計書 §2.2）。
  // 代わりに「点数影響 ÷ 所要時間」の降順に並べ、その日の時間（予算、未選択なら完走に
  // 必要な 分/日）で線を引く。**総量は減らさない。線より下は順番待ちで翌日以降に戻る。**
  //
  // 1日全体の概念なので、絞り込み（学習場所×理解度）には依らない。復習due と新規着手枠を
  // 同じ土俵に並べる（維持コアと前進コアの1問あたりの点数影響はほぼ同じ大きさ・§3.3）。
  const todayPlan = useMemo(
    () => planToday({
      candidates: allQuestions
        .filter(q => {
          const r = reviews[q.id]
          return !!(r?.due_date && r.due_date <= todayStr) || todayNew.ids.has(q.id)
        })
        .map(q => ({ question: q, review: reviews[q.id] })),
      policy,
      budgetMinutes: timeBudget,
      stats: timeStats,
      today: todayStr,
      examDate: currentPlan?.exam_date ?? null,
      // 今日の新規着手枠。planToday はこれを「予算を超えても切らない」分として扱う
      // （①の期限超過ぶんで予算を使い切った日に、新規着手が0問へ落ちるのを防ぐ）。
      newIds: todayNew.ids,
    }),
    [allQuestions, reviews, todayNew, policy, timeBudget, timeStats, todayStr, currentPlan]
  )

  const filteredQuestions = useMemo(() => {
    const filtered = baseQuestions.filter(q => matchMode(q) && matchStatus(q.id))
    if (activeTab !== 'review') return filtered
    // 復習タブの並び順は「点数影響 ÷ 所要時間」の降順ただ1つ（planToday.orderByDensity）。
    //
    // 今日は planToday が引いたラインごとの順（🔴優先と新規着手枠が線の上に来るぶん、
    // 密度そのままの並びではない）。今日以外はラインの概念が無いので密度順そのもの。
    // どちらも順序の定義は同じ関数で、日付や予算の有無で優先度の意味は変わらない。
    if (selectedDate === todayStr) {
      const rank = todayPlan.rank
      return [...filtered].sort(
        (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
      )
    }
    // 並び順のキーは事前計算（比較の中で R を再計算しない）。
    // R の基準日は「今日」のまま（表示中の日付ではない）。未来日のキューであっても、
    // いま忘れかけている順に見せるほうが、その日に何を優先するかの判断に一致する。
    const rank = new Map(
      orderByDensity({
        candidates: filtered.map(q => ({ question: q, review: reviews[q.id] })),
        policy,
        stats: timeStats,
        today: todayStr,
        examDate: currentPlan?.exam_date ?? null,
      }).map((i, idx) => [i.id, idx] as const)
    )
    return [...filtered].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
    )
  }, [baseQuestions, reviews, activeTab, matchMode, matchStatus, todayStr, selectedDate, todayPlan, policy, timeStats, currentPlan])

  // いま一覧に出ているキュー全体の推定所要分（今日パネルの見出しに出す従属表示）。
  //
  // 【一本化】かつては estimateMinutes.planByBudget で「予算に収まる位置」も同時に求めて
  // いたが、その線は使われておらず（totalMinutes 以外のフィールドは未参照）、今日のラインは
  // planToday が引いている。予算の線を引く実装が2つ動いている状態だったため、単純合計に
  // 置き換えて planByBudget ごと削除した。
  const queueMinutes = useMemo(
    () => sumEstimateMinutes(filteredQuestions, reviews, timeStats),
    [filteredQuestions, reviews, timeStats]
  )

  // 今日の一手サマリ（課題9）。復習タブの最上部に出す1行ぶんの値を束ねる。
  // 分析タブを開かなくても「今日いくらやれば良いか・いまどこにいるか」が分かるようにする。
  // 今日すでに記録した問数（進捗バーの分子・Phase H）。todayReviewPlan と同じ母数
  // （allQuestions）から数え、「完了＋残り」が今日の総量として1本に閉じるようにする。
  const doneToday = useMemo(
    () => allQuestions.filter(q => reviews[q.id]?.last_reviewed === todayStr).length,
    [allQuestions, reviews, todayStr]
  )

  const todaySummary = useMemo(
    () => buildTodaySummary(todayPlan, scoreEstimate, passTarget, doneToday),
    [todayPlan, scoreEstimate, passTarget, doneToday]
  )

  // 分析タブの警告は1枚だけ（lib/planAlert.ts）。時間不足（policy.feasibility）と
  // 遅延の持続（pace.needsReplan）は原因も取れる手も同じなので、2枚に分けない。
  const planAlert = useMemo(
    () => buildPlanAlert({
      feasibility: policy.feasibility,
      pace: paceResult,
      estimateValidated: goalValidated,
    }),
    [policy, paceResult, goalValidated]
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

  // 分析タブに渡す理解度の内訳。円グラフ用の pieData と「今後7日間の復習予定」用の
  // scheduleData は Phase I（課題15）で不要になったため作らない。前者は積み上げバー1本に
  // 畳み、後者は復習タブの「先の予定」とペース分析の週次負荷予測が担う。
  const dashData = useMemo(() => {
    const counts: Record<Status, number> = { S: 0, A: 0, B: 0, C: 0, '未着手': 0 }
    allQuestions.forEach(q => { counts[reviews[q.id]?.status ?? '未着手']++ })
    return { counts }
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
  // 【Phase B-1】復習due と新規着手枠の区切り（課題3の小見出し）は撤去した。
  // planToday が両者を「点数影響 ÷ 所要時間」の1本の順序に統合したため、キューの途中に
  // 「ここから新規着手」の境界が存在しなくなった（新規着手枠は末尾に固まらない）。
  // 前進／維持の内訳は今日パネルの1行が担う（B-3）。
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
            policy={policy}
            fsrsParams={fsrsParams}
            onFsrsParamsChanged={reloadFsrsParams}
            onSaved={p => {
              setPlans(prev => ({ ...prev, [p.subject_id]: p }))
              refreshFinalChecks(p.exam_date)
            }}
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
            planAlert={planAlert}
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
                plan={todayPlan}
                isToday={isTodayView}
                dateLabel={formatMD(selectedDate)}
                queueCount={filteredQuestions.length}
                queueMinutes={queueMinutes}
                budget={timeBudget}
                onBudgetChange={changeTimeBudget}
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
                  // 今日のラインの区切り（planToday.ts・Phase B-1）。
                  // ここから下は"遅延"ではなく順番待ちで、翌日以降に必ず戻る。
                  // 1日全体の概念なので、今日タブ・全章・全状態を表示中のときだけ線を引く
                  // （絞り込み中は表示順が母数と一致せず、線の位置に意味が無くなるため）。
                  const showLine =
                    activeTab === 'review' &&
                    isTodayView &&
                    chapterCode === 'ALL' &&
                    filterModes.size === 0 &&
                    filterStatuses.size === 0 &&
                    idx === todayPlan.recommendedCount &&
                    todayPlan.recommendedCount < filteredQuestions.length

                  return (
                    <Fragment key={q.id}>
                    {showLine && (
                      <div className="flex items-center gap-2 py-1 select-none">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          {timeBudget !== null
                            ? `ここまでが${timeBudget}分ぶん · 以降は順番待ち（翌日以降に戻ります）`
                            : 'ここまでが今日の推奨 · 以降は順番待ち（翌日以降に戻ります）'}
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
                        setViewerQ({
                          id: q.id,
                          title: `${q.chapterName} 問${q.number}　${q.title}`,
                          solving: false,
                          partCount: partCountFromTitle(q.title),
                        })
                      }}
                      onSolveProblem={() => {
                        // 「問題を解く」= 解答時間の計測開始（§7.6）。A/B/C 押下時に秒数を確定する。
                        timersRef.current[q.id] = startTimer(todayStr)
                        setViewerQ({
                          id: q.id,
                          title: `${q.chapterName} 問${q.number}　${q.title}`,
                          solving: true,
                          partCount: partCountFromTitle(q.title),
                        })
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
          partCount={viewerQ.partCount}
          onClose={() => setViewerQ(null)}
          // 解いた直後にこの画面から記録して閉じる（課題8）。カードを探し直す視線移動をなくす。
          onRecord={(s, a) => { void updateStatus(viewerQ.id, s, a); setViewerQ(null) }}
          // 「わからない」: C を即時記録するが閉じない（解答・解説を読ませるため・設計 §2.3）。
          onGiveUp={a => { void updateStatus(viewerQ.id, 'C', a) }}
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
