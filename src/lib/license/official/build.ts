// 構造化データ → 検証ゲート → DB 行（licensehub-expansion.md §4.2・§4.4・§8・§9・§13・PR-D）。純関数。
//
// ゲートは「年度 × 式（択一／選択式）」の単位で判定する。1つでも error があれば、その単位は丸ごと保存しない
// （年度ごとに 70問/350肢・8科目/40空欄・正答の充足率100%・ID重複なし を満たすものだけを保存する）。
// 公式PDF由来の肢は law_status='unchecked'（§9。確認は PR-K）、explanation_source='none'、truth_source='derived'。
import type { AnswerSpec, ItemLabel, LawStatus, LicFormat, LicItemRow, LicQuestionRow } from '../../../domain/license.ts'
import { ITEM_LABELS, makeItemId, makeQuestionId, normalizeLabel } from '../../../domain/license.ts'
import { FIXTURE_YEARS, holdoutGroupOf } from '../ingest/schema.ts'
import { sentenceWithBlank } from './parseSentaku.ts'
import {
  classifyStudy, SENTAKU_BLANKS_PER_SUBJECT, SENTAKU_ORDER, sentakuBlankStudySubject, sentakuStudySubject,
  takuStudySubject, TAKU_ORDER, TAKU_QUESTIONS_PER_SUBJECT,
} from './subjects.ts'
import { findGarbled } from './text.ts'
import type {
  Direction, OfficialAnswers, OfficialCorrections, OfficialIssue, OfficialSentakuQuestion, OfficialTakuQuestion,
  OfficialYear, TakuKind,
} from './types.ts'

export type OfficialQuestionRow = Omit<LicQuestionRow, 'user_id' | 'updated_at'>
export type OfficialItemRow = Omit<LicItemRow, 'user_id' | 'updated_at'>

// 個数の問の照合用（書籍の ○ の数と比べる）
export interface CountCheck { questionId: string; direction: Direction; count: number }

export interface OfficialUnit {
  year: string
  format: LicFormat
  provided: boolean        // 問題・正答のどちらかでも与えられたか
  passed: boolean          // ゲートを通ったか（error が無い）
  issues: OfficialIssue[]
  questions: OfficialQuestionRow[]
  items: OfficialItemRow[]
  counts: CountCheck[]
}

export interface BuildOptions {
  fixture?: boolean
  corrections?: OfficialCorrections
  parseIssues?: OfficialIssue[]   // 抽出時の指摘（式ごとに振り分ける）
}

export const TAKU_TOTAL_QUESTIONS = TAKU_ORDER.length * TAKU_QUESTIONS_PER_SUBJECT   // 70
export const TAKU_TOTAL_ITEMS = TAKU_TOTAL_QUESTIONS * ITEM_LABELS.length              // 350
export const SENTAKU_TOTAL_QUESTIONS = SENTAKU_ORDER.length                           // 8
export const SENTAKU_TOTAL_BLANKS = SENTAKU_TOTAL_QUESTIONS * SENTAKU_BLANKS_PER_SUBJECT  // 40

// 温存グループ（§8）。pilot-r7-rk は R7 の択一 労基・安衛だけ（選択式の RK は含まない）。R8 は全部 gate-r8。
export function officialHoldoutGroup(year: string, format: LicFormat, scoredSubject: string): string | null {
  return holdoutGroupOf(year, format === 'taku' ? scoredSubject : '')
}

// ---------------------------------------------------------------------------
// truth の導出（§13）
//
// 1つ選べ: 選んだ肢だけが「誤り（または正しい）」、他は逆。組合せ: 選んだ2肢が方向どおり、他は逆。
// 個数: 0個・5個のときだけ全肢が決まる。それ以外は null（書籍から補う）。
// accepted（問題誤りの公表で複数を正解とした「1つ選ぶ」問）: 正解とされた肢がすべて方向どおり、他は逆。

export function deriveTruths(
  q: Pick<OfficialTakuQuestion, 'kind' | 'direction' | 'comboPairs' | 'countOptions'>, correct: number, accepted?: number[],
): (boolean | null)[] {
  const dirTrue = q.direction === 'right'
  if (q.kind === 'one') {
    const hit = accepted ?? [correct]
    return ITEM_LABELS.map((_, i) => (hit.includes(i + 1) ? dirTrue : !dirTrue))
  }
  if (q.kind === 'combo') {
    const pair = q.comboPairs?.[correct - 1] ?? []
    return ITEM_LABELS.map(l => (pair.includes(l) ? dirTrue : !dirTrue))
  }
  const n = q.countOptions?.[correct - 1]
  if (n === 0) return ITEM_LABELS.map(() => !dirTrue)
  if (n === ITEM_LABELS.length) return ITEM_LABELS.map(() => dirTrue)
  return ITEM_LABELS.map(() => null)
}

function choiceLine(q: OfficialTakuQuestion): string {
  if (q.kind === 'combo') return q.choices.map((c, i) => `${ITEM_LABELS[i]}（${c}）`).join('\u3000')
  if (q.kind === 'count') return q.choices.map((c, i) => `${ITEM_LABELS[i]} ${c}`).join('\u3000')
  return ''
}

const KIND_NAMES: Record<TakuKind, string> = { one: '1つ選ぶ', combo: '組合せ', count: '個数' }

function yearIssues(year: string, fixture: boolean): string[] {
  if (!/^[HR]\d{2}$/.test(year)) return [`年度の表記が不正（H29〜R08 の形）: ${year}`]
  const isFixture = FIXTURE_YEARS.includes(year)
  if (fixture && !isFixture) return [`フィクスチャの取り込みでは年度は ${FIXTURE_YEARS.join('/')} のみ: ${year}`]
  if (!fixture && isFixture) return [`フィクスチャ専用の年度（--fixture を付けて取り込む）: ${year}`]
  return []
}

function lawOf(correction: { action: string; note: string } | undefined): { law_status: LawStatus; law_note: string | null } {
  return correction?.action === 'excluded'
    ? { law_status: 'excluded', law_note: `問題誤りの公表により除外: ${correction.note}` }
    : correction?.action === 'multi'
      ? { law_status: 'unchecked', law_note: `問題誤りの公表により複数の選択肢を正解とした: ${correction.note}` }
      : { law_status: 'unchecked', law_note: correction ? `公表により正答を補正: ${correction.note}` : null }
}

// ---------------------------------------------------------------------------
// 択一式

// 昇順の番号を連続する範囲に分ける: [4,5,6,9] → [[4,6],[9,9]]
function ranges(ns: number[]): [number, number][] {
  const out: [number, number][] = []
  for (const n of ns) {
    const last = out[out.length - 1]
    if (last && last[1] === n - 1) last[1] = n
    else out.push([n, n])
  }
  return out
}

function buildTaku(year: string, taku: OfficialTakuQuestion[], answers: OfficialAnswers | null, opts: BuildOptions): Omit<OfficialUnit, 'year' | 'format' | 'provided' | 'passed'> {
  const issues: OfficialIssue[] = []
  const err = (where: string, reason: string) => issues.push({ level: 'error', where, reason })
  const warn = (where: string, reason: string) => issues.push({ level: 'warning', where, reason })
  const questions: OfficialQuestionRow[] = []
  const items: OfficialItemRow[] = []
  const counts: CountCheck[] = []
  const split = opts.corrections?.studySplit ?? {}

  const byKey = new Map<string, OfficialTakuQuestion[]>()
  for (const q of taku) {
    const key = `${q.scoredSubject}-${q.qNo}`
    byKey.set(key, [...(byKey.get(key) ?? []), q])
    if (!TAKU_ORDER.includes(q.scoredSubject) || !(q.qNo >= 1 && q.qNo <= TAKU_QUESTIONS_PER_SUBJECT)) {
      err(`${year} 択一 ${q.scoredSubject} 問${q.qNo}`, '択一式に無い科目・問番号')
    }
  }

  for (const code of TAKU_ORDER) {
    // 読めなかった問は「問4〜10」のように範囲でまとめて出す
    const missing = Array.from({ length: TAKU_QUESTIONS_PER_SUBJECT }, (_, i) => i + 1).filter(n => !byKey.has(`${code}-${n}`))
    for (const [from, to] of ranges(missing)) {
      err(`${year} 択一 ${code} 問${from}${to > from ? `〜${to}` : ''}`, '問が読めない（問番号・科目の見出しを確認）')
    }
    for (let n = 1; n <= TAKU_QUESTIONS_PER_SUBJECT; n++) {
      const where = `${year} 択一 ${code} 問${n}`
      const found = byKey.get(`${code}-${n}`) ?? []
      if (found.length === 0) continue
      if (found.length > 1) { err(where, `同じ問が ${found.length} 回読めた（ID重複）`); continue }
      const q = found[0]
      const qid = makeQuestionId({ year, format: 'taku', scoredSubject: code, qNo: n })
      const correction = opts.corrections?.questions?.[qid]
      const before = issues.filter(i => i.level === 'error').length

      if (!q.lead) err(where, '問の文が空')
      if (!q.kind) err(where, '問型を判定できない（肢の印 A〜E / ア〜オ と「組合せ」「いくつ」の語が食い違う）')
      if (!q.direction) err(where, '「誤っている／正しい」のどちらを選ぶ問か読めない')
      const labels = q.items.map(i => i.label).join('')
      if (labels !== ITEM_LABELS.join('')) err(where, `肢が A〜E（ア〜オ）の5つでない: ${q.items.map(i => i.labelRaw).join('') || '(なし)'}`)
      q.items.forEach(it => { if (!it.text) err(where, `肢 ${it.labelRaw} の本文が空`) })
      if (q.kind === 'combo' && (q.comboPairs?.length !== 5 || q.comboPairs.some(p => p.length !== 2 || p[0] === p[1]))) {
        err(where, `組合せの選択肢が5つ読めない: ${q.choices.join(' / ') || '(なし)'}`)
      }
      if (q.kind === 'count' && (q.countOptions?.length !== 5)) {
        err(where, `個数の選択肢が5つ読めない: ${q.choices.join(' / ') || '(なし)'}`)
      }
      for (const [part, text] of [['問の文', q.lead], ...q.items.map(it => [`肢 ${it.labelRaw}`, it.text]), ['選択肢', q.choices.join(' ')]] as [string, string][]) {
        for (const r of findGarbled(text)) err(where, `${part}: ${r}`)
      }

      // 正答
      let answer = answers?.taku[code]?.[n - 1] ?? null
      let accepted: number[] | undefined
      if (correction?.action === 'multi') {
        const list = Array.isArray(correction.correct) ? correction.correct.map(c => normalizeLabel(c)) : []
        if (q.kind !== 'one') err(where, '複数正答（multi）は「1つ選ぶ」問だけに指定できる')
        else if (list.length < 2 || list.some(c => !c) || new Set(list).size !== list.length) {
          err(where, `複数正答の指定が A〜E の2つ以上でない: ${JSON.stringify(correction.correct)}`)
        } else {
          answer = list[0]!
          accepted = list.map(c => ITEM_LABELS.indexOf(c!) + 1).sort((a, b) => a - b)
          warn(where, `問題誤りの公表により ${list.join('・')} をいずれも正答とする（本来の正答 ${list[0]}）: ${correction.note}`)
        }
      }
      if (correction?.action === 'correct') {
        const c = normalizeLabel(typeof correction.correct === 'string' ? correction.correct : '')
        if (!c) err(where, `補正の正答が A〜E でない: ${correction.correct}`)
        else { if (answer !== c) warn(where, `公表により正答を ${answer ?? '(なし)'} → ${c} に補正: ${correction.note}`); answer = c }
      }
      if (correction?.action === 'excluded') warn(where, `問題誤りの公表により除外（law_status='excluded'）: ${correction.note}`)
      if (!answer && correction?.action !== 'excluded') err(where, '正答が無い（正答表を確認。公表で全員正解などは corrections で補正）')

      // 学習科目（分割位置の検証。IP は §16 の要確認なので失敗、他は警告）
      const study = takuStudySubject(code, n, split)
      const judged = classifyStudy(code, [q.lead, ...q.items.map(i => i.text)].join(''))
      if (judged && judged !== study) {
        const reason = `学習科目の分割位置と本文が食い違う（割当 ${study} / 本文は ${judged} の語を含む）`
        if (code === 'IP') err(where, `${reason}。分割位置が違う年度は corrections の studySplit.IP で指定する`)
        else warn(where, reason)
      }

      if (issues.filter(i => i.level === 'error').length > before) continue
      const correct = answer ? ITEM_LABELS.indexOf(answer) + 1 : null
      const truths = correct ? deriveTruths(q, correct, accepted) : ITEM_LABELS.map(() => null)
      if (correct && q.kind === 'count') counts.push({ questionId: qid, direction: q.direction!, count: q.countOptions![correct - 1] })
      const spec: AnswerSpec | null = !correct ? null
        : q.kind === 'one' ? { kind: 'one', direction: q.direction!, correct, ...(accepted ? { accepted } : {}) }
        : { kind: q.kind!, correct } as AnswerSpec
      const line = choiceLine(q)
      questions.push({
        id: qid, year, format: 'taku', scored_subject: code, study_subject: study, q_no: n,
        stem: line ? `${q.lead}\n${line}` : q.lead,
        answer_spec: spec,
        source: 'honshiken',
        holdout_group: officialHoldoutGroup(year, 'taku', code),
      })
      q.items.forEach((it, i) => {
        items.push({
          id: makeItemId({ year, format: 'taku', scoredSubject: code, qNo: n, label: it.label }),
          question_id: qid,
          label: it.label,
          label_raw: it.labelRaw,
          statement: it.text,
          origin_statement: it.text,
          truth: truths[i],
          truth_source: 'derived',
          explanation: null,
          explanation_source: 'none',
          explanation_verified: false,
          topic_id: null,
          importance: null,
          ...lawOf(correction),
          study_subject: study,
          scored_subject: code,
        })
      })
      if (q.kind === 'count' && truths[0] === null) {
        warn(where, `個数の問（${KIND_NAMES.count}）のため truth は導出できない（null。書籍の ○× から補う）`)
      }
    }
  }
  return { issues, questions, items, counts }
}

// ---------------------------------------------------------------------------
// 選択式

function buildSentaku(year: string, sentaku: OfficialSentakuQuestion[], answers: OfficialAnswers | null, opts: BuildOptions): Omit<OfficialUnit, 'year' | 'format' | 'provided' | 'passed' | 'counts'> {
  const issues: OfficialIssue[] = []
  const err = (where: string, reason: string) => issues.push({ level: 'error', where, reason })
  const warn = (where: string, reason: string) => issues.push({ level: 'warning', where, reason })
  const questions: OfficialQuestionRow[] = []
  const items: OfficialItemRow[] = []
  const split = opts.corrections?.studySplit ?? {}

  for (const q of sentaku) {
    if (!SENTAKU_ORDER.includes(q.scoredSubject)) err(`${year} 選択式 ${q.scoredSubject}`, '選択式に無い科目')
  }
  for (const code of SENTAKU_ORDER) {
    const where = `${year} 選択式 ${code}`
    const found = sentaku.filter(q => q.scoredSubject === code)
    if (found.length === 0) { err(where, '科目が読めない（見出し・問番号を確認）'); continue }
    if (found.length > 1) { err(where, `同じ科目が ${found.length} 回読めた（ID重複）`); continue }
    const q = found[0]
    const qid = makeQuestionId({ year, format: 'sentaku', scoredSubject: code, qNo: null })
    const before = issues.filter(i => i.level === 'error').length

    if (!q.stem) err(where, '本文が空')
    const sorted = [...q.blanks].sort().join('')
    if (sorted !== ITEM_LABELS.join('')) {
      err(where, `空欄が A〜E の各1つでない（読めた空欄: ${q.blanks.join('') || 'なし'}。本文中の英大文字の誤認の疑い）`)
    }
    const bankSize = Object.keys(q.wordbank).length
    if (bankSize < SENTAKU_BLANKS_PER_SUBJECT) err(where, `語群が ${bankSize} 語しか読めない`)
    else if (bankSize !== 20) warn(where, `語群が ${bankSize} 語（通常は20語）`)
    Object.entries(q.wordbank).forEach(([n, w]) => { if (!w) err(where, `語群 ${n} が空`) })
    for (const r of findGarbled(q.stem)) err(where, `本文: ${r}`)
    for (const r of findGarbled(Object.values(q.wordbank).join(' '))) err(where, `語群: ${r}`)

    const blanks: Partial<Record<ItemLabel, number>> = {}
    const lawByLabel = new Map<ItemLabel, ReturnType<typeof lawOf>>()
    for (const label of ITEM_LABELS) {
      const itemId = makeItemId({ year, format: 'sentaku', scoredSubject: code, qNo: null, label })
      const correction = opts.corrections?.questions?.[itemId] ?? opts.corrections?.questions?.[qid]
      let n = answers?.sentaku[code]?.[label] ?? null
      if (correction?.action === 'correct') {
        const c = Number(correction.correct)
        if (!Number.isInteger(c)) err(where, `補正の正答が語群の番号でない: ${label} ${correction.correct}`)
        else { warn(where, `公表により空欄 ${label} の正答を ${n ?? '(なし)'} → ${c} に補正: ${correction.note}`); n = c }
      }
      if (correction?.action === 'multi') err(where, `空欄 ${label}: 複数正答（multi）は択一の問だけに指定できる`)
      if (correction?.action === 'excluded') warn(where, `空欄 ${label}: 問題誤りの公表により除外: ${correction.note}`)
      // 空欄ごとの語群: 正答表の ①〜④ は、その空欄の語群の位置 → 通し番号に直す（補正の番号も同じ扱い）
      const group = q.groups?.[label]
      if (group && n !== null) {
        if (!(n >= 1 && n <= group.length)) err(where, `空欄 ${label} の正答 ${n} がその空欄の語群（${group.length} 語）に無い`)
        n = group[n - 1] ?? null
      }
      if (q.groups && !group) err(where, `空欄 ${label} の語群が読めない（空欄ごとの語群の書式）`)
      if (n === null && correction?.action !== 'excluded') err(where, `空欄 ${label} の正答が無い`)
      else if (n !== null && !(String(n) in q.wordbank)) err(where, `空欄 ${label} の正答 ${n} が語群に無い`)
      if (n !== null) blanks[label] = n
      lawByLabel.set(label, lawOf(correction))
    }

    if (issues.filter(i => i.level === 'error').length > before) continue
    questions.push({
      id: qid, year, format: 'sentaku', scored_subject: code, study_subject: sentakuStudySubject(code), q_no: null,
      stem: q.stem,
      answer_spec: { kind: 'sentaku', blanks, wordbank: q.wordbank, ...(q.groups ? { groups: q.groups } : {}) },
      source: 'honshiken',
      holdout_group: officialHoldoutGroup(year, 'sentaku', code),
    })
    for (const label of ITEM_LABELS) {
      const statement = sentenceWithBlank(q.stem, label)
      items.push({
        id: makeItemId({ year, format: 'sentaku', scoredSubject: code, qNo: null, label }),
        question_id: qid,
        label,
        label_raw: label,
        statement,
        origin_statement: statement,
        truth: null,           // 空欄は ○× ではない（正答は answer_spec.blanks）
        truth_source: 'derived',
        explanation: null,
        explanation_source: 'none',
        explanation_verified: false,
        topic_id: null,
        importance: null,
        ...lawByLabel.get(label)!,
        study_subject: sentakuBlankStudySubject(code, label, split),
        scored_subject: code,
      })
    }
  }
  return { issues, questions, items }
}

// ---------------------------------------------------------------------------
// ゲート

function finish(year: string, format: LicFormat, provided: boolean, body: Omit<OfficialUnit, 'year' | 'format' | 'provided' | 'passed'>, extra: OfficialIssue[]): OfficialUnit {
  const issues = [...extra, ...body.issues]
  const err = (reason: string) => issues.push({ level: 'error', where: `${year} ${format === 'taku' ? '択一' : '選択式'}`, reason })
  const [wantQ, wantI] = format === 'taku' ? [TAKU_TOTAL_QUESTIONS, TAKU_TOTAL_ITEMS] : [SENTAKU_TOTAL_QUESTIONS, SENTAKU_TOTAL_BLANKS]
  if (provided) {
    if (body.questions.length !== wantQ || body.items.length !== wantI) {
      err(`件数が足りない: ${format === 'taku' ? '問' : '科目'} ${body.questions.length}/${wantQ}、${format === 'taku' ? '肢' : '空欄'} ${body.items.length}/${wantI}（上の失敗の問を除いた数）`)
    }
    const ids = [...body.questions.map(q => q.id), ...body.items.map(i => i.id)]
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
    if (dup.length > 0) err(`ID が重複: ${[...new Set(dup)].join(', ')}`)
  }
  const passed = provided && !issues.some(i => i.level === 'error')
  return {
    year, format, provided, passed, issues,
    // ゲートを通らなかった単位は1行も保存しない
    questions: passed ? body.questions : [],
    items: passed ? body.items : [],
    counts: passed ? body.counts : [],
  }
}

// 1年度ぶんを、択一・選択式それぞれゲートにかける。問題か正答の片方だけ与えられた式は、もう片方の欠けで失敗する。
export function buildOfficialYear(data: OfficialYear, opts: BuildOptions = {}): OfficialUnit[] {
  const year = data.year
  const yearErrs = yearIssues(year, !!opts.fixture)
  const units: OfficialUnit[] = []
  for (const format of ['taku', 'sentaku'] as const) {
    const label = format === 'taku' ? '択一' : '選択式'
    const where = `${year} ${label}`
    const problems = data[format]
    const answersGiven = !!data.answers && Object.keys(data.answers[format]).length > 0
    const provided = !!problems || answersGiven
    const extra: OfficialIssue[] = [
      ...yearErrs.map(reason => ({ level: 'error' as const, where, reason })),
      ...(opts.parseIssues ?? []).filter(i => i.where.startsWith(`${year} ${label}`) || i.where.startsWith(`${year} 正答 ${label}`)),
    ]
    if (provided && !problems) extra.push({ level: 'error', where, reason: '問題のテキストが与えられていない' })
    if (provided && !answersGiven) extra.push({ level: 'error', where, reason: '正答が与えられていない（正答の充足率 0%）' })
    const empty = { issues: [], questions: [], items: [], counts: [] }
    if (!provided) { units.push(finish(year, format, false, empty, [])); continue }
    const body = !problems ? empty
      : format === 'taku' ? buildTaku(year, problems as OfficialTakuQuestion[], data.answers, opts)
      : { ...buildSentaku(year, problems as OfficialSentakuQuestion[], data.answers, opts), counts: [] }
    units.push(finish(year, format, true, body, extra))
  }
  return units
}
