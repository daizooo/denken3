// 令和2年度 試験問題B No.1〜4（共通工学）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'B01' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R02_B_KYOUTSU: Explains = {
  B01: {
    explain: {
      point: 'TSで取得した鉛直角・距離はすべて採用し、その「平均値」を用いる。最小値ではない。',
      figures: [{
        type: 'rule',
        title: 'TS観測の要点（作業規程の準則）',
        rows: [
          { label: '観測', value: '水平角・鉛直角・距離を1視準で同時に' },
          { label: '鉛直角', value: '1視準1読定、望遠鏡正・反で1対回' },
          { label: '気象補正', value: 'TS整置点で測定。3・4級は標準大気圧でも可' },
          { label: '鉛直角・距離の値', value: 'すべて採用し平均値を用いる', trap: '最小値' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '水平角・鉛直角・距離は1視準で同時に観測するのが原則。' },
        { label: '⑵', ok: true, note: '鉛直角は1視準1読定、正・反で1対回。' },
        { label: '⑶', ok: true, note: '気温・気圧はTS整置点で測る。3・4級は標準大気圧でよい。' },
        { label: '⑷', ok: false, note: '取得した値はすべて採用し、平均値を用いる。' },
      ],
      basis: '作業規程の準則（国土交通省）基準点測量',
    },
  },
  B02: {
    explain: {
      point: '検査で不合格とされた工事材料は、所定の期日以内に工事現場外に搬出する。現場内に置いておくのではない。',
      figures: [{
        type: 'rule',
        title: '公共工事標準請負契約約款の要点',
        rows: [
          { label: '通常避けられない地盤沈下等の第三者損害', value: '発注者が負担' },
          { label: '一括委任・一括下請負', value: '原則として禁止' },
          { label: '検査不合格の材料', value: '工事現場外に搬出', trap: '工事現場内に存置' },
          { label: '現場代理人の常駐', value: '支障がなければ要しないとできる' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '通常避けることができない地盤沈下等による損害は発注者が負担する。' },
        { label: '⑵', ok: true, note: '工事の全部や主たる部分を一括して下請に出してはならない。' },
        { label: '⑶', ok: false, note: '不合格の材料は所定の期日以内に工事現場外に搬出する。' },
        { label: '⑷', ok: true, note: '運営に支障がなく連絡体制があれば常駐を要しないとできる。' },
      ],
      basis: '公共工事標準請負契約約款 6条・10条・13条・28条',
    },
  },
  B03: {
    explain: {
      point: 'マスカーブは下り＝盛土、上り＝切土。盛土はNo.0〜2とNo.4〜5の300m、切土はNo.2〜4の200mで、盛土区間の方が長い。',
      figures: [{
        type: 'svg',
        title: 'マスカーブの読み方',
        alt: '累加土量の曲線。No.0〜2は下り（盛土）、No.2〜4は上り（切土）、No.4〜5は下り（盛土）。No.0とNo.3で0となり土量が均衡し、終点は+4,000m³で残土となる。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 175"><rect width="340" height="175" fill="#fff"/><g stroke="#ccc"><line x1="40" y1="20" x2="40" y2="150"/><line x1="96" y1="20" x2="96" y2="150"/><line x1="152" y1="20" x2="152" y2="150"/><line x1="208" y1="20" x2="208" y2="150"/><line x1="264" y1="20" x2="264" y2="150"/><line x1="320" y1="20" x2="320" y2="150"/></g><line x1="40" y1="85" x2="320" y2="85" stroke="#888"/><g font-size="10" fill="#444" text-anchor="middle"><text x="40" y="14">No.0</text><text x="96" y="14">No.1</text><text x="152" y="14">No.2</text><text x="208" y="14">No.3</text><text x="264" y="14">No.4</text><text x="320" y="14">No.5</text></g><text x="34" y="88" font-size="10" fill="#444" text-anchor="end">0</text><polyline points="40,85 68,98 96,112 124,133 152,140 180,118 208,85 236,73 264,30 292,41 320,63" fill="none" stroke="#222" stroke-width="2"/><text x="96" y="160" font-size="11" fill="#b03030" text-anchor="middle">下り＝盛土 200m</text><text x="208" y="160" font-size="11" fill="#2f6a3a" text-anchor="middle">上り＝切土 200m</text><text x="292" y="160" font-size="11" fill="#b03030" text-anchor="middle">盛土 100m</text><text x="124" y="72" font-size="10" fill="#222">No.0〜3 で均衡</text><circle cx="320" cy="63" r="3" fill="#222"/><text x="318" y="102" font-size="10" fill="#222" text-anchor="end">終点 +4,000m³</text><text x="318" y="116" font-size="10" fill="#222" text-anchor="end">＝残土</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: 'No.0〜2は曲線が下がっているので盛土区間。' },
        { label: '⑵', ok: false, note: '盛土は計300m、切土は200m。盛土区間の方が長い。' },
        { label: '⑶', ok: true, note: 'No.0とNo.3の累加土量がともに0なので切土と盛土が均衡する。' },
        { label: '⑷', ok: true, note: '終点の累加土量が＋（約4,000m³）なので残土が出る。' },
      ],
      basis: '土工の教本類（土積曲線）',
    },
  },
  B04: {
    explain: {
      point: 'ほとんどの建設機械に使われているのはディーゼルエンジン。負荷への即応性・燃費・保全性が良いのもディーゼルの特徴。',
      figures: [{
        type: 'compare',
        title: 'ディーゼルとガソリンの比較',
        columns: ['ディーゼル', 'ガソリン'],
        rows: [
          { label: '建設機械での使用', cells: ['ほとんど', '小型機械の一部'] },
          { label: '熱効率（正味仕事）', cells: ['大きい', '小さい'] },
          { label: '排出ガスの後処理', cells: ['酸素・すす・硫黄分で難しい', '三元触媒でほぼ除去'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: 'ほとんどの建設機械に使われているのはディーゼルエンジン。' },
        { label: '⑵', ok: true, note: 'ガソリンは三元触媒でNOx・HC・COをほぼ除去できる。' },
        { label: '⑶', ok: true, note: '正味仕事として取り出せるエネルギーはガソリンの方が小さい。' },
        { label: '⑷', ok: true, note: 'ディーゼルは酸素・すす・硫黄分を含み、触媒での処理が難しい。' },
      ],
      basis: '建設機械の教本類（原動機）',
    },
  },
}
