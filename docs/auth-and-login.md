# Auth & Login

> 2026-07-12 加入。登入模式 = 資料來源(訪客→mock、你→Supabase)。

## 模型

| 登入方式 | 資料來源 | 用途 |
|---|---|---|
| **訪客 (Demo)** | 純前端 mock(localStorage 假資料) | 給看作品的人試用,永不碰你的真 DB |
| **Email / 密碼** | Supabase Auth + 你的真實 DB | 你本人日常使用 |
| **Google 登入** | Supabase Auth(Google OAuth) | 你本人,免記密碼 |

- `services/dataMode.ts` 的 `isMock()` 由登入模式決定(`setDataMode`);訪客或 Supabase 未設定 → mock。
- `features/auth/stores/authStore.ts` 管 session,mode 存 localStorage(`ki-auth-mode`),重整保持登入。
- Router `beforeEach` 守衛:未登入一律導向 `/login`;`/login` 是 blank layout(無側欄)。
- 權限:RLS 已做 `auth.uid() = user_id`,每個登入者只看自己的資料。訪客不需 Supabase 帳號。

## 你要在雲端做的設定(才能用帳號 / Google 登入)

### 1. Supabase 專案(見 setup-guide.md)
建專案 → 套 migration 0001–0004 → 填 `apps/web/.env`(URL + anon key)。設定好後,帳號登入自動生效。

### 2. Email 登入
Supabase → Authentication → Providers → Email(預設開啟)。到 Authentication → Users 手動建你的帳號,或開放註冊。

### 3. Google 登入
1. **Google Cloud Console**:建立 OAuth 2.0 用戶端 ID(Web application)。
   - Authorized redirect URI 填 Supabase 給的:`https://<project-ref>.supabase.co/auth/v1/callback`
   - 拿到 **Client ID** 與 **Client Secret**。
2. **Supabase** → Authentication → Providers → **Google** → 貼上 Client ID / Secret → 儲存。
3. 前端已接好:`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`。
4. 部署後,把正式網域也加進 Google 的 redirect URI 與 Supabase 的 Redirect URLs。

> 在設定好 Supabase 之前,登入頁的「訪客試用」就能體驗完整功能(mock 資料);Email/Google 會提示需先設定。

## 登入頁

`views/LoginView.vue` — Aurora 漸層背景 + glassmorphism 卡。三個入口:訪客試用(主)、Google、Email/密碼。`prefers-reduced-motion` 時關閉漸層動畫。

## 登出

側欄底部 power icon → `authStore.logout()` → 回 `/login`。
