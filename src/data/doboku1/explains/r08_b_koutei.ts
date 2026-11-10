// 令和8年度 試験問題B No.6・25〜27（工程管理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B06' の形。
// B06 は公式PDF（20260706d_mondaib.pdf p.4）でネットワーク（ダミー ④→⑦・⑧→⑤ を含む）を確認して計算。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R08_B_KOUTEI: Explains = {
  B06: {
    explain: {
      point: '全経路の日数を足し、最も長い経路がクリティカルパス（工期）。A→B→E→(ダミー)→I→K が33日で最長。',
      figures: [
        {
          type: 'rule',
          title: '経路ごとの日数（ダミーは0日）',
          rows: [
            { label: 'A→B→E→⑦→I→K', value: '5+7+6+0+7+8＝33日（最長）' },
            { label: 'A→B→C→D→J', value: '5+7+7+6+6＝31日' },
            { label: 'A→B→E→⑦→I→⑤→J', value: '5+7+6+0+7+0+6＝31日' },
            { label: 'A→G→H→I→K', value: '5+5+6+7+8＝31日' },
            { label: 'A→B→E→F→J', value: '5+7+6+5+6＝29日' },
          ],
        },
        {
          type: 'rule',
          title: '作業Eが3日遅れたら',
          rows: [
            { label: 'Eはクリティカルパス上', value: '余裕0日' },
            { label: '工期', value: '33＋3＝36日（3日遅れ）', trap: '2日遅れ' },
          ],
        },
      ],
      checks: [
        { label: '⑴', ok: true, note: '⓪①②④⑦⑧⑨（A・B・E・ダミー・I・K）が33日で最長。' },
        { label: '⑵', ok: true, note: '⑦の最早時刻は B・E 経由の18日（G・H 経由は16日）。' },
        { label: '⑶', ok: true, note: '最長経路の33日が工期。' },
        { label: '⑷', ok: false, note: 'Eはクリティカルパス上なので、3日遅れれば工期も3日遅れる。' },
      ],
      basis: 'ネットワーク式工程表の計算（最早開始時刻・クリティカルパス）',
    },
  },
  B25: {
    explain: {
      point: '工程管理は「早く終わらせる」ことが最優先ではない。品質・原価・安全とバランスをとった工程で進める。',
      figures: [{
        type: 'flow',
        title: '工程管理の機能',
        steps: ['計画（工程表を図化）', '統制：進度管理（計画と実施を比べ報告）', '改善：途中で再評価', '基本計画にフィードバック'],
      }],
      checks: [
        { label: '①', ok: false, note: '早さ最優先ではない。品質・原価・安全と調和した工程を目指す。' },
        { label: '②', ok: true, note: 'バーチャート・出来高累計曲線・ネットワークなどで図化する。' },
        { label: '③', ok: true, note: '進度管理は計画と実施を比べ、進捗を報告する。' },
        { label: '④', ok: true, note: '途中で再評価し、基本計画にフィードバックしてレベルアップする。' },
      ],
      basis: '土木施工管理の教本類（工程管理）',
    },
  },
  B26: {
    explain: {
      point: '工程表は「何が分かるか」で区別する。全体への影響はネットワーク、線状工事は斜線式、出来高比率はグラフ式。',
      figures: [{
        type: 'compare',
        title: '各種工程表の特徴',
        columns: ['分かること・向く工事'],
        rows: [
          { label: 'ネットワーク式', cells: ['作業の関係・工期への影響'] },
          { label: '斜線式', cells: ['トンネルなど線状に進む工事'] },
          { label: 'グラフ式', cells: ['縦軸に出来高比率、予定と実績を比較'] },
          { label: 'ガントチャート', cells: ['横軸に達成度。工期への影響は不明'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: 'ネットワーク・斜線式・グラフ式・ガントチャートの順。' },
        { label: '⑵', ok: false, note: '全体工期への影響がつかめるのはネットワーク式。' },
        { label: '⑶', ok: false, note: '出来高比率を縦軸にとるのはグラフ式。' },
        { label: '⑷', ok: false, note: '線状工事に使うのは斜線式。ガントチャートは達成度。' },
      ],
      basis: '土木施工管理の教本類（工程表の種類）',
    },
  },
  B27: {
    explain: {
      point: 'バーチャートは作りやすく所要日数が分かるが、予定と実績の比較には工夫が要る。4つとも適当。',
      figures: [{
        type: 'compare',
        title: 'バーチャートの長所・短所',
        columns: ['内容'],
        rows: [
          { label: '長所', cells: ['所要日数・流れが分かる、作りやすい'] },
          { label: '短所', cells: ['予定と実績の比較が線だけでは難しい'] },
          { label: '工夫', cells: ['進捗百分率を数字で添える'] },
          { label: '使い方', cells: ['実績を記入→遅延を査定→原因と対策'] },
        ],
      }],
      checks: [
        { label: '①', ok: true, note: '横軸が日数なので所要日数と作業の流れが分かる。' },
        { label: '②', ok: true, note: '所要時間・施工期間・順序から日程を割り付ける。' },
        { label: '③', ok: true, note: '線だけでは比較が難しいので進捗百分率を添える。' },
        { label: '④', ok: true, note: '実績を記入し、遅延があれば原因を調べて対策する。' },
      ],
      basis: '土木施工管理の教本類（横線式工程表）',
    },
  },
}
