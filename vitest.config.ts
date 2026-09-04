import { defineConfig } from 'vitest/config'

// 学習計画スタック（src/lib）の純関数だけを対象にする軽量な設定。
// DOM は要らないので environment は node のまま（jsdom を足さない）。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
