// 肢（一問一答）の単体コピー用テキスト（licensehub-expansion.md §6.3）。
//
// 既存の formatForClipboard（src/lib/questionText.ts）と同じ形にする:
// 問題文 → 「あなたの答え：」 → 25行の空行 → 【正解】【解説】。
// 貼り付け直後の画面には問題文だけが見え、スクロールしない限り答えが目に入らない。
import type { ItemBody } from './itemBody'

// questionText.ts の ANSWER_GAP_LINES と同じ値（既存ファイルを触らないため複製する）。
export const ITEM_ANSWER_GAP_LINES = 25

export function truthLabel(truth: boolean): string {
  return truth ? '○（正しい）' : '×（誤り）'
}

export function formatItemForClipboard(title: string, body: Pick<ItemBody, 'statement' | 'truth' | 'explanation'>): string {
  const gap = '\n'.repeat(ITEM_ANSWER_GAP_LINES)
  return [
    `【${title}】`,
    '',
    body.statement,
    '',
    '○ か × か',
    '',
    'あなたの答え：',
    gap,
    `【正解】${body.truth === null ? '（未確定）' : truthLabel(body.truth)}`,
    `【解説】${body.explanation?.trim() || '（解説なし）'}`,
  ].join('\n')
}
