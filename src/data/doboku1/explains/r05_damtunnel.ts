// 令和5年度 試験問題A No.33〜36（ダム・トンネル）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A33' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R05_DAMTUNNEL: Explains = {
  A33: {
    explain: {
      point: 'グラウチングの注入は「薄いものから濃いものへ」。初めから濃いと細かい割れ目の入口で詰まり、奥まで入らない。',
      figures: [{
        type: 'rule',
        title: 'ダムの基礎グラウチング',
        rows: [
          { label: 'コンソリデーション', value: '着岩部付近の遮水性改良・弱部補強' },
          { label: '注入の順序', value: '薄い配合から濃い配合へ切り換える', trap: '「濃い→薄い」は誤り' },
          { label: 'カーテン（コンクリートダム）', value: '上流フーチングまたは堤内通廊から施工' },
          { label: '仕様の見直し', value: '日々の施工結果から常に見直す' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '着岩部付近の遮水性改良と弱部の補強が目的。' },
        { label: '⑵', ok: false, note: 'ルジオン値に応じ、薄い配合から濃い配合へ順に注入する。' },
        { label: '⑶', ok: true, note: '上流フーチングや堤内通廊から施工するのが一般的。' },
        { label: '⑷', ok: true, note: '施工結果を反映して仕様を修正するのが効率的。' },
      ],
      basis: 'グラウチング技術指針・同解説（国土技術研究センター）',
    },
  },
  A34: {
    explain: {
      point: 'ダムコンクリートは部位で求める品質が違う。選択肢は説明と部位の入れ替えが多いので、部位→役割を対で覚える。',
      figures: [{
        type: 'compare',
        title: 'ダムコンクリートの配合区分と要求品質',
        columns: ['求められる品質'],
        rows: [
          { label: '外部コンクリート', cells: ['水密性・すりへり抵抗・凍結融解抵抗'] },
          { label: '内部コンクリート', cells: ['自重で水圧を支える質量と強度・低発熱・施工性'] },
          { label: '着岩コンクリート', cells: ['岩盤との付着・不陸に打ち込める一体性'] },
          { label: '構造用コンクリート', cells: ['鉄筋・埋設物との付着・狭い所への施工性'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '水密性・すりへり・凍結融解抵抗は外部コンクリートの要求品質。' },
        { label: '⑵', ok: false, note: '自重で水圧を支え低発熱が要るのは内部コンクリート。' },
        { label: '⑶', ok: false, note: '岩盤との付着性・一体性は着岩コンクリートの要求品質。' },
        { label: '⑷', ok: true, note: '構造用は鉄筋との付着と狭隘部への施工性が要る。' },
      ],
      basis: 'コンクリート標準示方書［ダムコンクリート編］（土木学会）',
    },
  },
  A35: {
    explain: {
      point: '吹付けコンクリートはノズルを吹付け面に「直角」に保つ。斜めだとはね返り（リバウンド）が増え、付着も悪くなる。',
      figures: [{
        type: 'rule',
        title: '山岳トンネルの支保工の施工',
        rows: [
          { label: '吹付け面の仕上げ', value: 'できるだけ平滑に（防水シート・覆工の保護）' },
          { label: '吹付けノズルの向き', value: '吹付け面に直角', trap: '「斜め方向」は誤り' },
          { label: '鋼製支保工の建込み', value: '一次吹付け後すみやかに' },
          { label: '鋼製支保工と吹付け', value: '一体化させて支保効果を確保' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '凹凸があると防水シートの破損や覆工のひび割れを招く。' },
        { label: '⑵', ok: false, note: 'ノズルは吹付け面に直角に保つ。斜めはリバウンドが増える。' },
        { label: '⑶', ok: true, note: '地山が悪い所で、一次吹付け後すみやかに建て込む。' },
        { label: '⑷', ok: true, note: '吹付けコンクリートと一体化させて効果を出す。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
  A36: {
    explain: {
      point: '変位は切羽の近くで大きく速く、離れると収束する。だから計測頻度は掘削直後ほど密に、切羽が離れるほど疎にする。',
      figures: [{
        type: 'svg',
        title: '切羽からの距離と変位・計測頻度',
        alt: '横軸は切羽からの距離。変位は切羽付近で急に増え、離れると収束する。計測頻度は切羽付近で密、離れると疎。',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><rect width="320" height="160" fill="#fff"/><line x1="40" y1="120" x2="300" y2="120" stroke="#333"/><line x1="40" y1="120" x2="40" y2="20" stroke="#333"/><text x="196" y="112" font-size="11" fill="#333">切羽からの距離 →</text><text x="6" y="16" font-size="11" fill="#333">変位</text><path d="M40 120 C70 60 110 40 160 34 S260 30 300 30" fill="none" stroke="#2a6fb0" stroke-width="2.5"/><g fill="#c33"><circle cx="46" cy="132" r="3"/><circle cx="54" cy="132" r="3"/><circle cx="62" cy="132" r="3"/><circle cx="70" cy="132" r="3"/><circle cx="80" cy="132" r="3"/><circle cx="94" cy="132" r="3"/><circle cx="112" cy="132" r="3"/><circle cx="140" cy="132" r="3"/><circle cx="180" cy="132" r="3"/><circle cx="240" cy="132" r="3"/><circle cx="300" cy="132" r="3"/></g><text x="44" y="150" font-size="11" fill="#c33" font-weight="bold">計測：密</text><text x="280" y="150" font-size="11" fill="#c33" font-weight="bold">疎</text><text x="96" y="96" font-size="11" fill="#2a6fb0">急に増える</text><text x="190" y="26" font-size="11" fill="#2a6fb0">収束</text></svg>',
      }],
      checks: [
        { label: '⑴', ok: true, note: '安全を確認し、実情に合う設計に修正して安全性と経済性を確保する。' },
        { label: '⑵', ok: true, note: '坑内の切羽観察・内空変位・天端沈下、坑外の地表面沈下など。' },
        { label: '⑶', ok: true, note: '支保パターン変更などに反映するため、速やかに整理する。' },
        { label: '⑷', ok: false, note: '掘削前後は密に、切羽が離れるに従って疎にする。逆である。' },
      ],
      basis: 'トンネル標準示方書［山岳工法編］（土木学会）',
    },
  },
}
