import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import App from './App.vue'
import { router } from './router'
import './assets/styles/main.css'

import { vTilt } from '@/directives/tilt'

// Vue Query:讀取路徑的快取/去重/重試(useCategoryEntries 等)。
// staleTime 30s:同分類翻頁回上一頁即時呈現快取,背景再刷新。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

const app = createApp(App)

app
  .use(createPinia())
  .use(router)
  .use(VueQueryPlugin, { queryClient })
  .directive('tilt', vTilt)

// Wait for the initial auth guard to restore the session and resolve the
// target route before rendering. Without this, App.vue briefly falls back to
// AppShell while route.meta is still empty, flashing authenticated UI before
// the login route is confirmed.
void router.isReady().then(() => app.mount('#app'))
