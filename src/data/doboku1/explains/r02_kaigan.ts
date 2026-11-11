// 令和2年度 試験問題A No.37〜40（海岸・港湾）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A37' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R02_KAIGAN: Explains = {
  A37: {
    explain: {
      point: '潜堤・人工リーフは天端が海面下。離岸堤に比べて反射波は小さいが、背後の堆砂機能も「小さい」。',
      figures: [{
        type: 'svg',
        title: '潜堤・人工リーフと離岸堤',
        alt: '潜堤は天端が海面下にあり、大きな波だけを減衰させる。離岸堤は天端が海面上に出ていて、背後に砂がたまりやすい。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 170"><rect width="340" height="170" fill="#fff"/><text x="10" y="18" font-size="12" font-weight="bold" fill="#222">潜堤・人工リーフ</text><rect x="10" y="40" width="150" height="50" fill="#dceaf6"/><line x1="10" y1="40" x2="160" y2="40" stroke="#3a6ea5" stroke-width="2"/><text x="12" y="34" font-size="10" fill="#3a6ea5">海面</text><path d="M45 90 L65 62 L115 62 L135 90 Z" fill="#9a8f78" stroke="#4d4636"/><text x="55" y="58" font-size="10" fill="#222">天端は海面下</text><text x="12" y="110" font-size="11" fill="#222">反射波：小</text><text x="12" y="126" font-size="11" fill="#222">背後の堆砂：小</text><text x="12" y="142" font-size="11" fill="#222">景観を損なわない</text><text x="12" y="158" font-size="11" fill="#b03030">航行・操業に注意</text><text x="180" y="18" font-size="12" font-weight="bold" fill="#222">離岸堤</text><rect x="180" y="40" width="150" height="50" fill="#dceaf6"/><line x1="180" y1="40" x2="330" y2="40" stroke="#3a6ea5" stroke-width="2"/><path d="M220 90 L240 28 L270 28 L290 90 Z" fill="#9a8f78" stroke="#4d4636"/><text x="236" y="24" font-size="10" fill="#222">海面上</text><text x="182" y="110" font-size="11" fill="#222">反射波：大</text><text x="182" y="126" font-size="11" fill="#222">背後の堆砂：大</text><text x="182" y="142" font-size="11" fill="#222">景観への影響あり</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: false, note: '反射波は小さいが、堤体背後の堆砂機能も離岸堤より小さい。' },
        { label: '⑵', ok: true, note: '見えないので景観は損なわないが、船舶航行・漁業の安全に配慮する。' },
        { label: '⑶', ok: true, note: '捨石などの没水構造物で、静穏化と沿岸漂砂の制御を担う。' },
        { label: '⑷', ok: true, note: '小さな波は透過させ、大きな波を選択的に減衰させる。' },
      ],
      basis: '海岸保全施設の技術上の基準・同解説',
    },
  },
  A38: {
    explain: {
      point: '堤体の盛土材料は、若干の粘土を含む粒度分布のよい砂質・砂礫質のものを使う。粘土を含まず粒径のそろった材料は締まりにくい。',
      figures: [{
        type: 'rule',
        title: '海岸堤防の施工の要点',
        rows: [
          { label: '海上工事', value: '波浪・潮汐・潮流で作業時間が制限される' },
          { label: '強度の低い地盤', value: '押え盛土・地盤改良を考慮' },
          { label: '盛土材料', value: '若干の粘土を含む粒度分布のよい砂質・砂礫質', trap: '粘土を含まない粒径のそろったもの' },
          { label: '裏法', value: '直高が大きいと小段を設ける' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '海上工事は波浪・潮の影響で作業時間が制限される。' },
        { label: '⑵', ok: true, note: '強度の低い地盤では押え盛土・地盤改良を考慮する。' },
        { label: '⑶', ok: false, note: '若干の粘土を含む粒度分布のよい材料を使う。粒径のそろった材料は不適。' },
        { label: '⑷', ok: true, note: '直高が大きいと法面が長くなるので小段を設ける。' },
      ],
      basis: '海岸保全施設の技術上の基準・同解説',
    },
  },
  A39: {
    explain: {
      point: 'ケーソン据付けは、着底直前でいったん注水を止めて位置を確認・修正してから着底させる。一気に注水しない。',
      figures: [{
        type: 'flow',
        title: 'ケーソン据付けの手順',
        steps: ['所定位置まで曳航', '各隔室に平均的に注水', '着底直前で注水を止める', '位置を確認・修正', '再び注水して着底', '速やかに中詰・ふたコンクリート'],
        branches: [{ from: 1, label: '途中で止める', to: '中断せず一気に着底', bad: true }],
      }],
      checks: [
        { label: '⑴', ok: true, note: '曳航から据付け・中詰まで連続するので気象・海象を十分に検討する。' },
        { label: '⑵', ok: true, note: '大廻しワイヤは二重回しで、吃水線以下の浮心付近に取り付ける。' },
        { label: '⑶', ok: true, note: '短時間で、各隔室に平均的に注水する。' },
        { label: '⑷', ok: false, note: '着底直前で注水を止め、位置を確認・修正してから着底させる。' },
      ],
      basis: '港湾工事共通仕様書、港湾の施設の技術上の基準・同解説',
    },
  },
  A40: {
    explain: {
      point: 'ドラグサクション浚渫船は自航式で泥倉に積んで運べるので機動性が高く、船舶が頻繁に通る航路の維持浚渫に向く。',
      figures: [{
        type: 'compare',
        title: '浚渫船の特徴',
        columns: ['特徴', '主な用途'],
        rows: [
          { label: 'ポンプ浚渫船', cells: ['大量・広範囲。仕上がりの凹凸が大きい', '埋立て用の大規模浚渫'] },
          { label: 'ドラグサクション', cells: ['自航・泥倉に積載。機動性が高い', '航路の維持浚渫'] },
          { label: 'グラブ浚渫船', cells: ['土質を選ばない。中小規模', '構造物の周り・基礎床掘り'] },
          { label: 'バックホゥ浚渫船', cells: ['硬土盤も掘れる。中小規模', '狭い場所・構造物の周り'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'ポンプ浚渫は仕上がりの凹凸が大きく、構造物の築造箇所には向かない。' },
        { label: '⑵', ok: true, note: '自航・積載で機動性が高く、航路の維持浚渫に使う。' },
        { label: '⑶', ok: false, note: 'グラブ浚渫は中小規模向きで、構造物の基礎の床掘りなどに使う。' },
        { label: '⑷', ok: false, note: 'バックホゥ浚渫船は中小規模の浚渫に使う。大規模ではない。' },
      ],
      basis: '港湾工事共通仕様書、浚渫工事の教本類',
    },
  },
}
