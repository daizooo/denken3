// service worker の登録（課題7b・Phase F）。main.tsx から1回だけ呼ぶ。
//
// 本番のみ登録する。開発（vite dev）では、SW が居ると HMR の取得が
// キャッシュに掴まれて「直したのに変わらない」を招くため、逆に登録済みSWを剥がす。

// 新SWが主導権を取ったときに1度だけリロードするためのフラグ。
let reloading = false

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  if (!import.meta.env.PROD) {
    // 開発中は残っているSWを解除する（本番→dev の行き来でキャッシュが効いてしまうのを防ぐ）。
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    return
  }

  // 初回インストールでも clients.claim() で controllerchange が発火する。
  // そのときのリロードは不要（まだ古いページを見ていない）ので、
  // 「既に誰かが制御していたか」で更新かどうかを見分ける。
  const hadController = !!navigator.serviceWorker.controller

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    location.reload()
  })

  // load 後に登録して、初回表示のためのネットワーク帯域を奪わない。
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => {
      console.error('service worker の登録に失敗しました', e)
    })
  })
}
