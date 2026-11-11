// 令和7年度 試験問題A No.50〜54（鋼構造物塗装・上下水道）の図解解説。Claude 作成・根拠未確認（verified=false）。
// 問題本文は含めない（公式PDFが正本・DB のみ）。キーは 'A50' の形。検証は src/lib/doboku1/explain.ts。
import type { Explains } from '../../../lib/doboku1/build.ts'

export const R07_SUIDOU: Explains = {
  A50: {
    explain: {
      point: '塗料の粘度調整は、塗料に適した専用のシンナー（希釈剤）で行う。プライマーは下塗り塗料であり、希釈には使わない。',
      figures: [{
        type: 'rule',
        title: '鋼構造物塗装の施工管理',
        rows: [
          { label: '多液形・高粘度塗料の攪拌', value: '攪拌機で均一にする' },
          { label: '可使時間', value: '塗料ごとに定められた時間を守る' },
          { label: '粘度調整（希釈）', value: '塗料に適したシンナー', trap: 'プライマーで希釈' },
          { label: '屋内で温湿度を調整', value: '屋外の気象に関係なく塗装できる' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '均一化して乾きむらを防ぐため攪拌機を用いる。' },
        { label: '⑵', ok: true, note: '可使時間を過ぎた塗料は性能不足・欠陥の原因になる。' },
        { label: '⑶', ok: false, note: '希釈は塗料に適したシンナーで行う。プライマーは下塗り塗料。' },
        { label: '⑷', ok: true, note: '温湿度が管理された屋内なら、屋外の気象条件に左右されない。' },
      ],
      basis: '鋼道路橋防食便覧（日本道路協会）',
    },
  },
  A51: {
    explain: {
      point: '公道に布設する配水管の位置は、道路管理者との協議で決める。労働基準監督署は協議先ではない。土被り・離隔の数値も押さえる。',
      figures: [
        {
          type: 'svg',
          title: '配水管の埋設位置と深さ（模式図）',
          alt: '道路の横断面。路面から配水管の頂部までの土被りが標準1.2m（協議で0.6mまで減少可）、隣の地下埋設物との離隔が0.3m以上であることを示す。',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#fff"/><rect x="10" y="30" width="300" height="160" fill="#e9dfc7"/><rect x="10" y="22" width="300" height="10" fill="#555"/><text x="130" y="16" font-size="12" fill="#222">路面（公道）</text><circle cx="110" cy="140" r="22" fill="#cfd8e3" stroke="#2a5db0" stroke-width="2"/><text x="90" y="182" font-size="12" fill="#2a5db0">配水管</text><circle cx="220" cy="140" r="16" fill="#ddd" stroke="#666" stroke-width="2"/><text x="190" y="182" font-size="12" fill="#444">他の埋設物</text><line x1="110" y1="32" x2="110" y2="118" stroke="#d33" stroke-width="2"/><line x1="104" y1="32" x2="116" y2="32" stroke="#d33"/><line x1="104" y1="118" x2="116" y2="118" stroke="#d33"/><text x="16" y="70" font-size="11" fill="#d33">土被り</text><text x="16" y="84" font-size="11" fill="#d33">標準1.2m</text><text x="16" y="98" font-size="10" fill="#d33">協議で0.6mまで</text><line x1="132" y1="140" x2="204" y2="140" stroke="#d33" stroke-width="2"/><text x="140" y="132" font-size="11" fill="#d33">離隔0.3m以上</text></svg>',
        },
        {
          type: 'rule',
          title: '協議・承認の相手',
          rows: [
            { label: '公道に布設', value: '道路管理者と協議', trap: '労働基準監督署' },
            { label: '河川敷・軌道敷・私有地', value: '敷地管理者・土地所有者の使用承認' },
          ],
        },
      ],
      checks: [
        { label: '⑴', ok: false, note: '配置は道路管理者との協議で決める。労働基準監督署ではない。' },
        { label: '⑵', ok: true, note: '敷地管理者・土地所有者と協議し使用承認を得る。' },
        { label: '⑶', ok: true, note: '土被りは標準1.2m。道路管理者との協議で0.6mまで減らせる。' },
        { label: '⑷', ok: true, note: '他の埋設物とは0.3m以上の離隔を確保する。' },
      ],
      basis: '水道施設設計指針（日本水道協会）、道路法施行令11条の3',
    },
  },
  A52: {
    explain: {
      point: '更生工法4種の名称と説明を対応させる問題。正しいのはさや管工法。⑴は形成工法、⑵は製管工法、⑷は反転工法の説明に入れ替わっている。',
      figures: [{
        type: 'compare',
        title: '下水道管渠の更生工法',
        columns: ['方法の要点'],
        rows: [
          { label: '反転工法', cells: ['樹脂含浸材を加圧しながら反転挿入し、加圧状態で硬化'] },
          { label: '形成工法', cells: ['樹脂材を引き込み、加圧・拡張・圧着後に硬化・冷却固化'] },
          { label: 'さや管工法', cells: ['小さな管径の工場製品を牽引挿入し、間隙に充塡材'] },
          { label: '製管工法', cells: ['塩ビ材等を管内でかん合し、間隙にモルタル等を充塡'] },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '引き込み・拡張・圧着後に硬化させるのは形成工法。' },
        { label: '⑵', ok: false, note: '管内で樹脂材をかん合し間隙を充塡するのは製管工法。' },
        { label: '⑶', ok: true, note: 'さや管工法の説明として正しい。' },
        { label: '⑷', ok: false, note: '加圧しながら挿入し加圧状態で硬化させるのは反転工法。' },
      ],
      basis: '管きょ更生工法における設計・施工管理ガイドライン（日本下水道協会）',
    },
  },
  A53: {
    explain: {
      point: 'ボーリング方式は先導体前面が開放しているため、地下水位以下の砂質土地盤では補助工法で安定処理をしてから適用する。粘性土ではない。',
      figures: [{
        type: 'rule',
        title: '小口径管推進工法の注意点',
        rows: [
          { label: '圧入方式', value: '途中で中断せず一気に到達させる' },
          { label: 'オーガ方式', value: '粘性土で先端抵抗が急増→注水で軟化' },
          { label: 'ボーリング方式', value: '地下水位以下の砂質土は補助工法で安定処理', trap: '粘性土' },
          { label: '泥水方式', value: '高透水・緩い地盤は泥水の比重・粘性を上げる' },
        ],
      }],
      checks: [
        { label: '⑴', ok: true, note: '中断すると管が締め付けられ推進不能になるおそれがある。' },
        { label: '⑵', ok: true, note: '粘性土で先端抵抗が増えたら注水で切羽の土を軟らかくする。' },
        { label: '⑶', ok: false, note: '補助工法が要るのは地下水位以下の砂質土地盤。粘性土ではない。' },
        { label: '⑷', ok: true, note: '泥水の比重・粘性を高め、逸泥防止材を使う。' },
      ],
      basis: '下水道推進工法の指針と解説（日本下水道協会）',
    },
  },
  A54: {
    explain: {
      point: '薬液注入の地下水監視井戸は、注入箇所からおおむね10m以内に数か所設ける。20m以内ではない。注入中・注入後も一定期間監視する。',
      figures: [{
        type: 'rule',
        title: '薬液注入工事の管理（暫定指針）',
        rows: [
          { label: '監視井戸の位置', value: '注入箇所からおおむね10m以内に数か所', trap: '20m以内' },
          { label: '監視期間', value: '注入前・注入中・注入後の一定期間' },
          { label: '注入量500kℓ以上', value: '原料タンクと調合槽の間に流量積算計' },
          { label: '調合水', value: '原則水道水。代わりはpH5.8〜8.6' },
        ],
      }],
      checks: [
        { label: '⑴', ok: false, note: '監視井戸はおおむね10m以内に数か所。20mではない。' },
        { label: '⑵', ok: true, note: '500kℓ以上の大型工事は流量積算計で水ガラス使用量を確認する。' },
        { label: '⑶', ok: true, note: '大深度では二重管ストレーナー工法の削孔精度は低い。' },
        { label: '⑷', ok: true, note: '水道水が使えないときはpH5.8〜8.6の水を使う。' },
      ],
      basis: '薬液注入工法による建設工事の施工に関する暫定指針（建設省）',
    },
  },
}
