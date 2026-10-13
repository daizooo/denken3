# LicenseHub

資格試験（電験三種・社労士）の演習・記録用の個人向け PWA。

- 表示名は `src/config/app.ts` の `APP_NAME` に集約している。変更時は `index.html`
  と `public/manifest.webmanifest` も合わせて更新する（`src/config/app.test.ts` が不一致を検出する）。
- 内部識別子（`exam_id='denken3'`、`denken_*` テーブル、IndexedDB `electricpro-offline` など）は
  互換のため旧名のまま据え置く。

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # vitest
npm run build   # 型検査＋ビルド
npm run lint    # oxlint
```
