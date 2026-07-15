import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 測試涵蓋兩塊:apps/web 前端單元(分類器/元件)與
// supabase/functions/extract 的純函式(ssrf.ts 不碰 Deno API,可直接測)。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
