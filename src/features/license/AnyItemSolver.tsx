// 解答画面の入口。選択式の空欄なら SentakuSolver、択一式の肢なら ItemSolver、1級土木（D1_）なら Doboku1ItemSolver、2級建設経理（K2_）なら Kenkei2ItemSolver（props は共通）。
import { isSentakuItemId } from '../../lib/license/sentakuItem'
import ItemSolver from './ItemSolver'
import SentakuSolver from './SentakuSolver'
import Doboku1ItemSolver from '../doboku1/Doboku1ItemSolver'
import Kenkei2ItemSolver from '../kenkei2/Kenkei2ItemSolver'

type Props = Parameters<typeof ItemSolver>[0]

export default function AnyItemSolver(props: Props) {
  if (props.itemId.startsWith('D1_')) return <Doboku1ItemSolver {...props} />
  if (props.itemId.startsWith('K2_')) return <Kenkei2ItemSolver {...props} />
  return isSentakuItemId(props.itemId) ? <SentakuSolver {...props} /> : <ItemSolver {...props} />
}
