import { Image as ImageIcon } from 'lucide-react'
import type { MasterQuestion, Review, Status } from '../../domain/types'
import { hasKnownAsset } from '../../lib/assets'
import { dueColorClass, formatDue, formatMD } from '../../lib/date'
import { STATUS_BG, STATUS_LABEL } from '../shared/status'

export interface QuestionWithChapter extends MasterQuestion {
  chapterName: string
  chapterCode: string
}

export default function QuestionCard({
  q, review, activeTab, todayStr,
  isEditing, editMemo, onEditMemoChange, onToggleEdit, onSaveMemo,
  onRecordStatus, onOpenViewer,
  dateValue, dateOpen, onOpenDate, onDateChange, onResetDate,
  onDeleteEntry,
}: {
  q: QuestionWithChapter
  review: Review
  activeTab: 'review' | 'list' | 'dashboard'
  todayStr: string
  isEditing: boolean
  editMemo: string
  onEditMemoChange: (v: string) => void
  onToggleEdit: () => void
  onSaveMemo: () => void
  onRecordStatus: (status: Status) => void
  onOpenViewer: () => void
  dateValue: string
  dateOpen: boolean
  onOpenDate: () => void
  onDateChange: (v: string) => void
  onResetDate: () => void
  onDeleteEntry: (index: number) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-3.5">
        {/* Meta */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">{q.chapterName} 問{q.number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BG[review.status]}`}>
            {review.status}
          </span>
          {'difficulty' in q && (
            <span className="text-xs text-gray-300">{'★'.repeat(q.difficulty as number)}</span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-gray-800 leading-snug">{q.title}</p>

        {/* 日付ステータス（ラベル付き） */}
        {review.status === '未着手' ? (
          <p className="text-xs text-gray-300 mt-1.5">未学習 · A / B / C で今日の理解度を記録</p>
        ) : (
          <div className="flex items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs flex-wrap">
            {review.last_reviewed && (
              <span className="text-gray-400">
                学習日 <span className="text-gray-600 font-medium">{formatMD(review.last_reviewed)}</span>
              </span>
            )}
            {review.due_date && (
              <span className="flex items-center gap-1">
                <span className="text-gray-300">/</span>
                <span className="text-gray-400">次回復習</span>
                <span className={`font-medium ${dueColorClass(review.due_date)}`}>
                  {formatMD(review.due_date)}（{formatDue(review.due_date)}）
                </span>
              </span>
            )}
          </div>
        )}

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

        {/* 理解度の記録（A/B/Cを押した日が実施日として記録される）*/}
        {/* 記録済みでも押した状態にはしない（最初からタップして見える紛らわしさを解消）。
            記録した理解度は上部のステータスバッジと履歴で確認できる。 */}
        <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
          {(['A', 'B', 'C'] as Status[]).map(s => (
            <button key={s}
              onClick={() => onRecordStatus(s)}
              title={STATUS_LABEL[s]}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600 transition-all"
            >{s}</button>
          ))}
          {hasKnownAsset(q.id) && (
            <button
              onClick={onOpenViewer}
              className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 hover:border-blue-400 px-2 py-1.5 rounded-lg transition-colors"
            >
              <ImageIcon size={13} /> 問題を見る
            </button>
          )}
          {activeTab === 'list' && (
            <button
              onClick={onToggleEdit}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >{isEditing ? '閉じる' : 'メモ'}</button>
          )}
        </div>

        {/* 実施日（通常は今日。過去に解いた分だけ日付を変更）*/}
        <div className="flex items-center gap-1.5 mt-1.5 text-xs">
          <span className="text-gray-400">実施日</span>
          {dateOpen ? (
            <>
              <input
                type="date"
                value={dateValue}
                max={todayStr}
                autoFocus
                onChange={e => onDateChange(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-blue-300 bg-white"
              />
              <button
                onClick={onResetDate}
                className="text-gray-400 hover:text-gray-600"
              >今日に戻す</button>
            </>
          ) : (
            <button
              onClick={onOpenDate}
              title="過去に解いた日付で記録したいとき変更します"
              className={`inline-flex items-center gap-0.5 ${
                dateValue === todayStr ? 'text-gray-500' : 'text-blue-600 font-medium'
              }`}
            >
              {dateValue === todayStr ? '今日' : formatMD(dateValue)}
              <span className="text-gray-300">▾</span>
            </button>
          )}
        </div>

        {/* Edit panel（メモのみ・全問題タブ）*/}
        {isEditing && activeTab === 'list' && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">メモ</p>
              <textarea
                value={editMemo}
                onChange={e => onEditMemoChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 h-24 resize-none focus:outline-none focus:border-blue-300 bg-white"
                placeholder="公式・間違えたポイントなど..."
              />
            </div>
            <button
              onClick={onSaveMemo}
              className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >保存</button>
          </div>
        )}

        {/* 学習履歴（初回から蓄積・✕で取り消し）*/}
        {review.review_history.length > 0 && !isEditing && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1 items-center">
            <span className="text-xs text-gray-400 mr-0.5">履歴</span>
            {review.review_history.map((entry, idx) => {
              const label = idx === 0 ? '初回' : `${idx}回目`
              return (
                <span key={idx} className="text-xs text-gray-300 inline-flex items-center">
                  {idx > 0 && <span className="mr-1">→</span>}
                  <span className={`${STATUS_BG[entry.status]} px-1 py-0.5 rounded inline-flex items-center gap-1`}>
                    {label} {formatMD(entry.date)}
                    <button
                      onClick={() => onDeleteEntry(idx)}
                      title="この記録を取り消す"
                      className="text-gray-400 hover:text-red-500 leading-none"
                    >×</button>
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
