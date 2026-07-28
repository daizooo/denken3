import { useEffect, useRef } from 'react'
import {
  FileText, Undo2, Redo2, Printer, Bold, Italic, Underline,
  AlignLeft, List, ListOrdered, Search,
} from 'lucide-react'

// ==============================
// パニックカバー（ダミー文書エディタ）
// 擬装モード中、マウスを画面隅へ・ウィンドウ非アクティブ等で発動し、学習画面を
// 全面で覆う「業務文書エディタ風」のダミー。記者の業務（記事下書き）らしく見せる。
//
// 復帰: 左上のアプリアイコン（文書アイコン）を「ダブルクリック」すると学習画面へ戻る。
//       本文はそのまま入力できるので、覗かれている間は文字を打って作業中を装える。
// ==============================
export default function PanicOverlay({ onReveal }: { onReveal: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // 表示直後に本文へフォーカスを当て、いつでもタイプできる状態にしておく。
  useEffect(() => {
    bodyRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[2147483647] bg-[#f8f9fa] text-gray-800 select-none flex flex-col"
      style={{ fontFamily: 'system-ui, "Segoe UI", "Yu Gothic", "Meiryo", sans-serif' }}
    >
      {/* ===== タイトルバー（メニュー） ===== */}
      <div className="flex items-center gap-3 px-3 h-11 border-b border-gray-200 bg-white">
        {/* 復帰トリガー: この文書アイコンをダブルクリックで学習画面へ戻る */}
        <button
          onDoubleClick={onReveal}
          title=""
          className="shrink-0 grid place-items-center w-8 h-8 rounded hover:bg-gray-100"
        >
          <FileText size={20} className="text-blue-600" />
        </button>
        <div className="flex flex-col leading-tight">
          <span className="text-sm text-gray-800">無題のドキュメント</span>
          <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
            {['ファイル', '編集', '表示', '挿入', '表示形式', 'ツール', 'ヘルプ'].map(m => (
              <span key={m} className="hover:text-gray-800 cursor-default">{m}</span>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-gray-500">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-400">
            <Search size={13} /> <span>ドキュメント内を検索</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white grid place-items-center text-xs">S</div>
        </div>
      </div>

      {/* ===== ツールバー ===== */}
      <div className="flex items-center gap-1 px-3 h-10 border-b border-gray-200 bg-[#f8f9fa] text-gray-600">
        <ToolBtn><Undo2 size={16} /></ToolBtn>
        <ToolBtn><Redo2 size={16} /></ToolBtn>
        <ToolBtn><Printer size={16} /></ToolBtn>
        <span className="px-2 text-sm text-gray-500">100%</span>
        <Divider />
        <span className="px-2 py-1 text-sm rounded hover:bg-gray-200 cursor-default">標準テキスト</span>
        <Divider />
        <span className="px-2 py-1 text-sm rounded hover:bg-gray-200 cursor-default">游ゴシック</span>
        <span className="px-2 py-1 text-sm rounded hover:bg-gray-200 cursor-default">11</span>
        <Divider />
        <ToolBtn><Bold size={16} /></ToolBtn>
        <ToolBtn><Italic size={16} /></ToolBtn>
        <ToolBtn><Underline size={16} /></ToolBtn>
        <Divider />
        <ToolBtn><AlignLeft size={16} /></ToolBtn>
        <ToolBtn><List size={16} /></ToolBtn>
        <ToolBtn><ListOrdered size={16} /></ToolBtn>
      </div>

      {/* ===== 用紙 ===== */}
      <div className="flex-1 overflow-auto bg-[#f0f1f3] py-8">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="mx-auto bg-white shadow-sm outline-none px-16 py-14 text-[15px] leading-8 text-gray-800"
          style={{ width: 'min(816px, 92vw)', minHeight: '1056px' }}
        >
          <p className="font-bold text-lg mb-4">取材メモ（下書き）</p>
          <p className="mb-3">
            県発注の道路改良工事に関する記者発表について、担当課への確認事項と当日の要点を整理する。
            発表資料の配布は午後を予定しており、事前に工程と発注区分を押さえておく必要がある。
          </p>
          <p className="mb-3">
            ・工事概要：延長および幅員、主な構造物の有無を確認。図面の提供可否も併せて打診する。
          </p>
          <p className="mb-3">
            ・入札方式：一般競争か指名か、総合評価の適用範囲について担当者に確認する。予定価格の
            公表時期は要注意。
          </p>
          <p className="mb-3">
            ・スケジュール：公告日、入札日、開札、契約締結の各節目を時系列で押さえる。年度内完了の
            見込みも確認しておくこと。
          </p>
          <p className="mb-3">
            ・関係者コメント：発注課長への囲み取材を想定。地元への説明状況と安全対策の方針を尋ねる。
          </p>
          <p className="text-gray-400">｜</p>
        </div>
      </div>

      {/* ===== ステータスバー ===== */}
      <div className="h-7 border-t border-gray-200 bg-white px-4 flex items-center text-xs text-gray-400">
        <span>ページ 1 / 1</span>
        <span className="ml-4">単語数を表示</span>
        <span className="ml-auto">最終編集: たった今</span>
      </div>
    </div>
  )
}

function ToolBtn({ children }: { children: React.ReactNode }) {
  return <span className="p-1.5 rounded hover:bg-gray-200 cursor-default">{children}</span>
}
function Divider() {
  return <span className="mx-1 w-px h-5 bg-gray-300" />
}
