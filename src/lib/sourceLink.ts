// 分野別（オーム社「分野別過去問」）のタイトルに書かれた出典表記から、
// 年度別（CBT模試）ペーパーの該当問題を機械的に解決する純関数群（課題6・Phase E）。
//
//   '抵抗直並列回路（H16-A4/R6下-A7）' → 出典 'R6下-A7' → 年度別問題 'r6-2_a07'
//
// 目的: `PaperQuestion.sourceQuestionId` を108問ぶん手入力する代わりに、既にタイトルへ
// 書かれている出典から起動時に組み立てる。年度別で誤答した問題に対応する分野別問題を
// 今日の復習へ前倒しする `boostReview` は、このリンクが無いと一度も発火しない。
// タイトルへ出典を補記すれば、コード変更なしにリンクが増える。
//
// 原本の表記ゆれ（実データで確認したもの）を吸収する:
//  - 区切りは半角 '/' と全角 '／' が混在する（'H30／R5上' 等）。
//  - セクション記号(A/B)が落ちた表記がある（'R5下-5'）。電験三種は A問題1〜14・
//    B問題15〜18 で固定のため、問番号から補う。
//  - 年度だけで問番号が無い表記がある（'R6上'）。リンクできないため incomplete に返す
//    （＝出典の補記作業で問番号を足すべき箇所の一覧になる）。
//  - 平成（H…）と、年度別ペーパーが未収録の回（令和1〜4年度等）は対象外として黙って捨てる。
//    後からペーパーを収録すれば自動で拾われる。
import type { Chapter, PaperDefinition } from '../domain/types'

// 出典1件の表記。'R6下-A7' / 'R5下-5' / 'R6上' / 'H16-A4' のいずれにもマッチする。
// 1: 元号(H|R) 2: 年 3: 上/下 4: セクション(A|B・省略可) 5: 問番号（省略可）
const SOURCE_TOKEN = /^([HR])(\d{1,2})(上|下)?(?:-([AB])?(\d{1,2}))?$/

// 電験三種の1回分は A問題1〜14 / B問題15〜18。セクション記号が落ちた表記の補完に使う。
const MAX_SECTION_A = 14

/** 出典の解決結果。問番号が無い表記は questionId が null。 */
export interface ResolvedSource {
  paperId: string              // 'r6-2'
  questionId: string | null    // 'r6-2_a07'。問番号が無い表記は null
}

/** リンク構築の結果。 */
export interface SourceLinkResult {
  /** 年度別の問題ID → 分野別の問題ID。boostReview の引き当てに使う。 */
  links: Map<string, string>
  /** 出典が「収録済みの回」を指しているのに問番号が無く、リンクできなかった分野別問題ID。 */
  incomplete: string[]
  /** データの誤り（存在しない問番号・同じ年度別問題への重複リンク）。ビルド時に落とす。 */
  errors: string[]
}

/**
 * タイトル中の全角括弧から出典表記を取り出す。
 * 括弧の中身を '/'・'／' で分割し、出典の形をした要素だけを返す
 * （'（応用）'・'（難問）' のような注記は落ちる）。
 */
export function parseSourceTokens(title: string): string[] {
  const tokens: string[] = []
  for (const group of title.matchAll(/（([^）]*)）/g)) {
    for (const part of group[1].split(/[/／]/)) {
      const token = part.trim()
      if (SOURCE_TOKEN.test(token)) tokens.push(token)
    }
  }
  return tokens
}

/**
 * タイトルに書かれた出典の件数＝過去の出題回数（§8.4・課題11）。
 * 収録済みの回に限らず平成の出典も数える（「よく出る問題か」の指標なので、
 * 年度別ペーパーを収録しているかどうかとは無関係）。出典が無ければ 0。
 */
export function sourceFrequency(title: string): number {
  return parseSourceTokens(title).length
}

/**
 * 出典表記1件を年度別ペーパーの問題IDへ解決する。
 * 令和・上期/下期が揃わない表記（平成・年度のみで期が無い等）は null。
 */
export function resolveSource(token: string): ResolvedSource | null {
  const m = token.match(SOURCE_TOKEN)
  if (!m) return null
  const [, era, year, half, section, number] = m
  // 年度別ペーパーは令和の上期/下期のみ。平成と期の無い表記はペーパーに対応しない。
  if (era !== 'R' || !half) return null
  const paperId = `r${Number(year)}-${half === '上' ? 1 : 2}`
  if (!number) return { paperId, questionId: null }
  const n = Number(number)
  // セクション記号が落ちた表記は問番号から補う（A:1〜14 / B:15〜18）。
  const sec = (section ?? (n <= MAX_SECTION_A ? 'A' : 'B')).toLowerCase()
  return { paperId, questionId: `${paperId}_${sec}${String(n).padStart(2, '0')}` }
}

/**
 * 分野別の章一覧と年度別ペーパー一覧から、年度別→分野別のリンクを組み立てる。
 * 収録されていない回を指す出典は黙って捨てる（回を追加すれば自動で拾われる）。
 * 同一科目内で呼ぶこと（問題IDは科目スコープで一意）。
 */
export function buildSourceLinks(chapters: Chapter[], papers: PaperDefinition[]): SourceLinkResult {
  // 収録済みの回 → その回の問題IDの集合。未収録の回を指す出典と、誤った問番号を区別する。
  const paperQuestionIds = new Map<string, Set<string>>()
  for (const paper of papers) {
    paperQuestionIds.set(paper.id, new Set(paper.questions.map(q => q.id)))
  }

  const links = new Map<string, string>()
  const incomplete: string[] = []
  const errors: string[] = []

  for (const chapter of chapters) {
    for (const question of chapter.questions) {
      for (const token of parseSourceTokens(question.title)) {
        const resolved = resolveSource(token)
        if (!resolved) continue
        const ids = paperQuestionIds.get(resolved.paperId)
        if (!ids) continue                       // 未収録の回
        if (!resolved.questionId) {              // 問番号が無い（補記待ち）
          incomplete.push(question.id)
          continue
        }
        if (!ids.has(resolved.questionId)) {
          errors.push(`${question.id}: 出典 '${token}' に対応する年度別問題 '${resolved.questionId}' が存在しません`)
          continue
        }
        const existing = links.get(resolved.questionId)
        if (existing && existing !== question.id) {
          errors.push(`${resolved.questionId}: 分野別の複数問題から参照されています（${existing} / ${question.id}）`)
          continue
        }
        links.set(resolved.questionId, question.id)
      }
    }
  }

  return { links, incomplete, errors }
}
