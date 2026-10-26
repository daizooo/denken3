// 肢モードの入口。選択式の空欄なら SentakuSolver、択一式の肢なら ItemSolver を開く（props は共通）。
import { isSentakuItemId } from '../../lib/license/sentakuItem'
import ItemSolver from './ItemSolver'
import SentakuSolver from './SentakuSolver'

type Props = Parameters<typeof ItemSolver>[0]

export default function AnyItemSolver(props: Props) {
  return isSentakuItemId(props.itemId) ? <SentakuSolver {...props} /> : <ItemSolver {...props} />
}
