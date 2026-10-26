# LicenseHub

社会保険労務士試験の演習・記録用の個人向け PWA。

- 表示名は `src/config/app.ts` の `APP_NAME` に集約している。変更時は `index.html`
  と `public/manifest.webmanifest` も合わせて更新する（`src/config/app.test.ts` が不一致を検出する）。
- 内部識別子（`denken_*` テーブル、IndexedDB `electricpro-offline`、Cache 名 `electricpro-*` など）は
  旧名（電験時代）のまま据え置く。改名すると既存の進捗・送信待ち・キャッシュが失われるため。

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # vitest
npm run build   # 型検査＋ビルド
npm run lint    # oxlint
```
