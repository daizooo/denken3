import { defineConfig } from 'vitest/config'

// 学習計画スタック（src/lib）と Serverless Function の純関数を対象にする軽量な設定。
// DOM は要らないので environment は node のまま（jsdom を足さない）。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
