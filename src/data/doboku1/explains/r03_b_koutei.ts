// 令和3年度 試験問題B No.6・25〜27（工程管理）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B06' の形。検証は src/lib/doboku1/explain.ts。
// B06 は DB の図（dbk_figures）でネットワーク（A5・B7・C6・D6・E12・F4・G6・H8・I12・J11、②→③ダミー）を確認。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R03_B_KOUTEI: Explains = {
  B06: {
    explain: {
      point: 'クリティカルパスは C→ダミー→E→I の30日。E はこの経路上にあるので、E の2日遅れはそのまま工期の2日遅れになる。',
      figures: [{
        type: 'svg',
        title: 'ネットワークとクリティカルパス',
        alt: 'ネットワーク式工程表。結合点0から7まで。赤線のC（6日）→ダミー→E（12日）→I（12日）が最長の30日でクリティカルパス。Eが14日になると32日。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 250" font-family="sans-serif" font-size="12"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#555"/></marker><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d62728"/></marker></defs><g fill="none" stroke="#555" stroke-width="1.5" marker-end="url(#a)"><path d="M30 78 V40 H158"/><path d="M182 40 H310 V78"/><path d="M42 90 H158"/><path d="M182 150 H238"/><path d="M262 150 H310 V102"/><path d="M170 162 V210 H238"/><path d="M262 210 H390 V102"/></g><g fill="none" stroke="#d62728" stroke-width="3" marker-end="url(#r)"><path d="M30 102 V150 H158"/><path d="M170 138 V102" stroke-dasharray="5 3"/><path d="M182 90 H298"/><path d="M322 90 H378"/></g><g fill="#fff" stroke="#333"><circle cx="30" cy="90" r="12"/><circle cx="170" cy="40" r="12"/><circle cx="170" cy="90" r="12"/><circle cx="170" cy="150" r="12"/><circle cx="250" cy="150" r="12"/><circle cx="310" cy="90" r="12"/><circle cx="250" cy="210" r="12"/><circle cx="390" cy="90" r="12"/></g><g text-anchor="middle"><text x="30" y="94">0</text><text x="170" y="44">1</text><text x="170" y="94">3</text><text x="170" y="154">2</text><text x="250" y="154">4</text><text x="310" y="94">5</text><text x="250" y="214">6</text><text x="390" y="94">7</text><text x="100" y="34">B 7</text><text x="245" y="34">D 6</text><text x="100" y="84">A 5</text><text x="100" y="168" fill="#d62728">C 6</text><text x="240" y="84" fill="#d62728">E 12→14</text><text x="350" y="84" fill="#d62728">I 12</text><text x="210" y="144">F 4</text><text x="285" y="144">G 6</text><text x="205" y="228">H 8</text><text x="320" y="228">J 11</text></g><text x="10" y="244" fill="#d62728">クリティカルパス C→(ダミー)→E→I＝6+12+12＝30日 → E遅れで32日</text></svg>',
      }, {
        type: 'rule',
        title: '各経路の日数（E 遅延前 → 後）',
        rows: [
          { label: 'C→ダミー→E→I', value: '30日 → 32日（最長のまま）' },
          { label: 'A→E→I', value: '29日 → 31日' },
          { label: 'C→F→G→I', value: '28日（変わらず）' },
          { label: 'B→D→I', value: '25日（変わらず）' },
          { label: 'C→H→J', value: '25日（変わらず）' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'E はクリティカルパス上なので遅れは1日ではなく2日。' },
        { label: '⑵', ok: true, note: '30日 → 32日で、当初の工期より2日遅れる。' },
        { label: '⑶', ok: false, note: 'クリティカルパス上の作業が遅れるので工期どおりには終わらない。' },
        { label: '⑷', ok: false, note: '経路は C→ダミー→E→I のまま変わらない。' },
      ],
      basis: 'ネットワーク式工程表の最早開始時刻の計算',
    },
  },
  B25: {
    explain: {
      point: '工程管理は「工程計画」をもとに、「時間」を基準に評価し、計画を実施する「統制機能」と改善機能からなる。工程表は「施工順序」と進捗速度を表す。',
      figures: [{
        type: 'rule',
        title: '工程管理の考え方',
        rows: [
          { label: 'イ 実施のもと', value: '工程計画', trap: '統制機能' },
          { label: 'ロ 評価の基準', value: '時間', trap: '品質' },
          { label: 'ハ 計画を実施する機能', value: '統制機能', trap: '工程計画' },
          { label: 'ニ 工程表が表すもの', value: '施工順序と進捗速度', trap: '管理基準' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'イとハが逆。評価基準は品質ではなく時間。' },
        { label: '⑵', ok: false, note: '評価基準は時間。工程表が表すのは施工順序。' },
        { label: '⑶', ok: true, note: '工程計画・時間・統制機能・施工順序の組合せ。' },
        { label: '⑷', ok: false, note: 'イとハが逆。工程表が表すのは施工順序。' },
      ],
      basis: '土木工事の工程管理の一般原則（教本類）',
    },
  },
  B26: {
    explain: {
      point: '余裕時間まで分かる＝ネットワーク式、出来高比率の累計＝グラフ式、達成度％＝ガントチャート、線状に一方向へ進む工事＝斜線式。',
      figures: [{
        type: 'compare',
        title: '工程表の特徴',
        columns: ['横軸／縦軸', '向き・弱点'],
        rows: [
          { label: 'ネットワーク式', cells: ['作業の順序関係', '余裕時間が分かる／作業が多いと煩雑'] },
          { label: 'グラフ式', cells: ['工期／出来高比率', '予定と実績の差を直感的に比較'] },
          { label: 'ガントチャート', cells: ['達成度（％）／作業', '工期に影響する作業が不明'] },
          { label: '斜線式', cells: ['距離／工期', 'トンネル等の線状で一方向に進む工事'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: 'ネットワーク式・グラフ式・ガントチャート・斜線式の組合せ。' },
        { label: '⑵', ok: false, note: '出来高比率はグラフ式、達成度はガントチャート。バナナ曲線は管理用。' },
        { label: '⑶', ok: false, note: '余裕時間が分かるのはネットワーク式。線状工事は斜線式。' },
        { label: '⑷', ok: false, note: '余裕時間が分かるのはネットワーク式。出来高比率はグラフ式。' },
      ],
      basis: '土木工事の工程管理の一般原則（教本類）',
    },
  },
  B27: {
    explain: {
      point: 'バーチャートはガントチャートの欠点を改良したもので、作成は容易。ただし作業の手順（相互関係）は不明確。竣工日から逆にたどるのは逆算法。',
      figures: [{
        type: 'rule',
        title: 'バーチャート（横線式工程表）',
        rows: [
          { label: 'イ 改良した元', value: 'ガントチャート', trap: 'グラフ式工程表' },
          { label: 'ロ 作成', value: '比較的容易', trap: '難しい' },
          { label: 'ハ 明確でないこと', value: '他工種との相互関係・手順・全体工期への影響' },
          { label: 'ニ 竣工期日からたどる', value: '逆算法', trap: '順行法は着手日から' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '改良元はガントチャート。竣工日からたどるのは逆算法。' },
        { label: '⑵', ok: true, note: 'ガントチャート・容易な・手順・逆算法の組合せ。' },
        { label: '⑶', ok: false, note: '作成は容易。所要日数はバーチャートで明確に分かる。' },
        { label: '⑷', ok: false, note: '改良元はガントチャート、作成は容易、竣工日からは逆算法。' },
      ],
      basis: '土木工事の工程管理の一般原則（教本類）',
    },
  },
}
