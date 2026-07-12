# Frontend Architecture

## Framework

Vue 3 + Vite + TypeScript(`<script setup lang="ts">`)、Vue Router、Pinia、Tailwind CSS v4。

## 分層

```
apps/web/src/
├─ App.vue                 # 只當 shell:<AppLayout><RouterView/></AppLayout>
├─ main.ts                 # createApp + pinia + router + 全域 CSS
├─ layouts/AppLayout.vue   # Header / 連線提示 / main / footer
├─ views/                  # 路由級頁面
│  ├─ InboxView.vue        # 收件匣(篩選列 + 卡牆 + 新增/編輯 Modal)
│  ├─ EntryDetailView.vue
│  └─ NotFoundView.vue
├─ features/
│  ├─ entries/
│  │  ├─ api/entriesApi.ts        # entry CRUD + tag join(supabase-js)
│  │  ├─ stores/inboxStore.ts     # 狀態總管:entries/typeDefs/tags/filters
│  │  ├─ components/              # EntryCard / EntryForm / EntryFilterBar / TypeBadge
│  │  └─ types.ts
│  ├─ tags/api/tagsApi.ts
│  └─ types/api/typeDefinitionsApi.ts
├─ components/common/       # BaseButton / BaseInput / BaseModal / LoadingState
├─ router/index.ts
├─ services/
│  ├─ supabaseClient.ts     # 單一 client + isSupabaseConfigured
│  └─ session.ts            # ensureSession(匿名登入)
└─ assets/styles/main.css   # @import "tailwindcss" + @theme token
```

## Router

`createWebHistory`;路由 lazy import。`/` → Inbox、`/entries/:id` → Detail、catch-all → 404。

## State management

Pinia setup store `useInboxStore`:持有 `entries` / `typeDefinitions` / `tags` / `filters`,
action `init()`(ensureSession + 載入)、`setFilters()`(改篩選即 reload)、`saveEntry()` / `removeEntry()`。
資料流單向:元件 → store action → api → supabase → store 更新 → 元件。

## features 分層規則

- 功能元件放 `features/{feature}/components/`,不塞 `components/common/`
- API 呼叫只在 `features/{feature}/api/` 或 `services/`,不寫在 template
- 共用基礎 UI(Button/Input/Modal/Loading)才放 `components/common/`

## App.vue 邊界

只能是 shell。禁止在 `App.vue` 寫主要畫面、表單、清單。

## API client 放置

`services/supabaseClient.ts` 匯出單一 client;各 feature 的 `api/` 引用它。
`requireSupabase()` 在未設定時丟明確錯誤而非 null-deref。

## Schema-driven UI

`type_definitions.attrs_schema` 驅動 `EntryForm` 的屬性欄位與 `EntryCard` 的屬性顯示。
新增類型 = DB 插一筆,前端零改動。`parseAttrField()`(`@inbox/shared-types`)把 `"enum:a/b"` 解析成下拉。
