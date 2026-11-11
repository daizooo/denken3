// 令和7年度 試験問題B No.6・25〜27（工程管理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B06' の形。検証は src/lib/doboku1/explain.ts。
// B06 の最早時刻は dbk_figures（D1_R07_B_06）のネットワーク図（A〜K の日数・ダミー ④→⑦・⑧→⑤）から計算。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R07_B_KOUTEI: Explains = {
  B06: {
    explain: {
      point: '最早時刻を順に求めると⑤は⑧からのダミーで24日、⑨は J の経路で30日。工期は29日ではなく30日。',
      figures: [
        {
          type: 'rule',
          title: '各結合点の最早開始時刻',
          rows: [
            { label: '①・②・⑥', value: '5日・10日・12日（⑥＝A5＋G7）' },
            { label: '③・④', value: '16日・16日' },
            { label: '⑦', value: '18日（⑥＋H6。④からのダミーは16日）' },
            { label: '⑧', value: '24日（⑦＋I6）' },
            { label: '⑤', value: '24日（⑧からのダミー。D経由22・F経由23）' },
            { label: '⑨（工期）', value: '30日（⑤＋J6。K経由は29）', trap: '29日' },
          ],
        },
        {
          type: 'flow',
          title: 'クリティカルパス（30日）',
          steps: ['⓪→①（A 5日）', '①→⑥（G 7日）', '⑥→⑦（H 6日）', '⑦→⑧（I 6日）', '⑧→⑤（ダミー）', '⑤→⑨（J 6日）'],
        },
      ],
      checks: [
        { label: '⑴', ok: true, note: 'A→G→H→I→ダミー→J が最長経路（30日）。' },
        { label: '⑵', ok: true, note: '⑤の最早時刻は24日なので、J は24日に開始できる。' },
        { label: '⑶', ok: false, note: '工期は30日。29日は K 経由の経路の日数。' },
        { label: '⑷', ok: true, note: 'D 経由は10＋6＋9＝25日で⑤へ。J を足すと31日で1日遅れる。' },
      ],
      basis: 'ネットワーク式工程表の計算（最早開始時刻・クリティカルパス）',
    },
  },
  B25: {
    explain: {
      point: 'ネットワーク式工程表の基本用語の問題。アクティビティ・イベント・ダミーの意味と PERT・CPM の違いはいずれも適当で、4つとも正しい。',
      figures: [{
        type: 'compare',
        title: 'ネットワーク式工程表の用語',
        columns: ['意味'],
        rows: [
          { label: 'アクティビティ', cells: ['作業。矢線で左から右へ結ぶ'] },
          { label: 'イベント', cells: ['結合点（〇）。中に正整数のイベント番号'] },
          { label: 'ダミー', cells: ['所要時間0の擬似作業。前後関係だけを示す'] },
          { label: 'PERT／CPM', cells: ['日程・配員・費用の計画／費用と工期の最適化'] },
        ],
      }],
      checks: [
        { label: '①', ok: true, note: '作業を矢線で左から右へ結び、網状の矢線図で表す。' },
        { label: '②', ok: true, note: '結合点を〇で表しイベントと呼び、正整数の番号を付ける。' },
        { label: '③', ok: true, note: 'PERT 系は日程・配員・費用の計画、CPM は工期と費用の最適化。' },
        { label: '④', ok: true, note: 'ダミーは所要時間を持たず、作業相互の関係を示す。' },
      ],
      basis: '土木施工管理の教本類（工程管理・ネットワーク手法）',
    },
  },
  B26: {
    explain: {
      point: '施工を速めると原価は下がるが、速めすぎると逆に高くなる。品質を上げると原価は高く、突貫で品質は悪くなる。三者は相反する関係。',
      figures: [{
        type: 'rule',
        title: '品質・工程・原価の関係',
        rows: [
          { label: '工程と原価（イ）', value: '速めすぎると逆に高くなる', trap: 'ますます安く' },
          { label: '原価と品質（ロ）', value: '良い品質は原価が高くなる' },
          { label: '品質と工程（ハ）', value: '突貫作業で品質は悪くなる', trap: 'かわらない' },
          { label: '三者の関係（ニ）', value: '相反する性質', trap: '同じような' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'イは逆に高く、ハは悪くなる。' },
        { label: '⑵', ok: true, note: '逆に高く・高く・悪くなる・相反するの組合せ。' },
        { label: '⑶', ok: false, note: 'ロは高く、ニは相反する。' },
        { label: '⑷', ok: false, note: 'イ・ロ・ハ・ニともに逆。' },
      ],
      basis: '土木施工管理の教本類（工程・原価・品質の関係）',
    },
  },
  B27: {
    explain: {
      point: 'バナナ曲線は上方・下方の許容限界の間に実施工程を保つ管理手法。上を超えれば不経済、下を下回れば遅れ。4つとも適当。',
      figures: [{
        type: 'rule',
        title: '工程管理曲線（バナナ曲線）の見方',
        rows: [
          { label: '上方限界を超えた', value: '進み過ぎ。過大な機械投入など不経済を検討' },
          { label: '下方限界を下回った', value: '遅れ。施工計画を根本的に再検討' },
          { label: '下方限界に近づいた', value: '直ちに対策をとる' },
          { label: '許容限界内', value: '中期の勾配を理想工程曲線より緩やかに調整' },
        ],
      }],
      checks: [
        { label: '①', ok: true, note: '進み過ぎは不経済になっていないか検討する。' },
        { label: '②', ok: true, note: '下回ると突貫工事が避けられず、計画を根本から見直す。' },
        { label: '③', ok: true, note: '下方限界に近づいたら直ちに対策をとる。' },
        { label: '④', ok: true, note: '中期の正常工程部分を理想工程曲線より緩勾配に調整する。' },
      ],
      basis: '土木施工管理の教本類（工程管理曲線）',
    },
  },
}
