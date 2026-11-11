// 令和2年度 試験問題B No.10〜13（工程管理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B10' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R02_B_KOUTEI: Explains = {
  B10: {
    explain: {
      point: '工程管理で施工段階を評価測定する基準は「時間（工期）」。品質を基準にするのは品質管理。',
      figures: [{
        type: 'compare',
        title: '管理の種類と評価の基準',
        columns: ['評価の基準'],
        rows: [
          { label: '工程管理', cells: ['時間（工期・進捗）'] },
          { label: '品質管理', cells: ['品質（規格値）'] },
          { label: '原価管理', cells: ['費用（実行予算）'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '品質・原価・安全を総合的に調整した工程計画をもとに実施する。' },
        { label: '⑵', ok: false, note: '工程管理の評価基準は時間（工期）。品質ではない。' },
        { label: '⑶', ok: true, note: '計画を実施する統制機能と、評価・処置する改善機能に大別される。' },
        { label: '⑷', ok: true, note: '工程表で進捗を把握し、計画とのずれを早期に是正する。' },
      ],
      basis: '土木施工管理の教本類（工程管理）',
    },
  },
  B11: {
    explain: {
      point: 'ガントチャートは横軸が進捗度（％）なので、各作業の所要日数は分からない。所要日数が分かるのはバーチャート。',
      figures: [{
        type: 'compare',
        title: '工程表の特徴',
        columns: ['横軸', '分かること'],
        rows: [
          { label: 'ガントチャート', cells: ['進捗度（％）', '達成度。所要日数は不明'] },
          { label: 'バーチャート', cells: ['日数（工期）', '所要日数・作業の流れ'] },
          { label: '斜線式', cells: ['距離・日数', '線状に一方向へ進む工事'] },
          { label: 'グラフ式', cells: ['工期（縦軸に出来高比率）', '予定と実績の差'] },
          { label: 'ネットワーク式', cells: ['（作業の関係図）', '工期への影響・資源計画'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'ガントチャートは所要日数が分からない。分かるのはバーチャート。' },
        { label: '⑵', ok: true, note: '斜線式はトンネルなど一方向に進む線状の工事に使う。' },
        { label: '⑶', ok: true, note: 'ネットワーク式はコンピューター処理で資源の経済的な計画が立てられる。' },
        { label: '⑷', ok: true, note: 'グラフ式は予定と実績の差を直視的に比較できる。' },
      ],
      basis: '土木施工管理の教本類（工程表）',
    },
  },
  B12: {
    explain: {
      point: '各経路の日数を足すと最長は A→B→C→D→J の28日。これがクリティカルパスで工期は28日。',
      figures: [{
        type: 'compare',
        title: '経路ごとの所要日数',
        columns: ['日数'],
        rows: [
          { label: 'A→B→C→D→J（CP）', cells: ['5+5+5+7+6＝28日'] },
          { label: 'A→B→E→F→J', cells: ['5+5+6+5+6＝27日'] },
          { label: 'A→B→C→D→（ダミー）→K', cells: ['5+5+5+7+4＝26日'] },
          { label: 'A→G→H→I→K', cells: ['5+2+7+7+4＝25日'] },
        ],
      }, {
        type: 'rule',
        title: '選択肢の数値',
        rows: [
          { label: '⑤の最早結合点時刻', value: 'C・D経路で22日（E・F経路は21日）' },
          { label: 'Kの最早開始', value: '⑤からダミー経由で22日', trap: '26日' },
          { label: '①→⑥→⑦→⑧の余裕', value: '⑧の最遅24日 −（5＋16）＝3日', trap: '4日' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '④を通る経路は27日。CPはC・Dを通る②→③→⑤。' },
        { label: '⑵', ok: false, note: '⑧の最遅は24日、①から16日かかるので余裕は3日。' },
        { label: '⑶', ok: false, note: 'Kの最早開始は⑤の22日（ダミー経由）。26日ではない。' },
        { label: '⑷', ok: true, note: '最長経路 A→B→C→D→J の28日が工期。' },
      ],
      basis: 'ネットワーク式工程表の計算（教本類）',
    },
  },
  B13: {
    explain: {
      point: 'バーチャートは作業の相互関係や全体工期への影響が「分かりにくい」。それが明確なのはネットワーク式工程表。',
      figures: [{
        type: 'compare',
        title: 'バーチャートとネットワーク式',
        columns: ['バーチャート', 'ネットワーク式'],
        rows: [
          { label: '作成・読取り', cells: ['簡単（作業数が少ない工事向き）', '複雑'] },
          { label: '所要日数・流れ', cells: ['見やすい', '分かる'] },
          { label: '相互関係・工期への影響', cells: ['不明確', '明確'] },
          { label: '全体の進捗', cells: ['工程管理曲線の併記で把握', '把握できる'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '簡単な工事向き。複雑な工事では作成・変更・読取りが難しい。' },
        { label: '⑵', ok: false, note: 'バーチャートは相互関係や工期への影響が明確でない。' },
        { label: '⑶', ok: true, note: 'タイムスケールで描かれ、作業全体の流れがおおよそ分かる。' },
        { label: '⑷', ok: true, note: '工程管理曲線（出来高累計曲線）を併記して全体の進捗を把握する。' },
      ],
      basis: '土木施工管理の教本類（工程表）',
    },
  },
}
