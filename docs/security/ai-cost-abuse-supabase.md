# AI 串接資安與成本控管 — Supabase 落地評估

- 建立日期:2026-07-13
- 狀態:v1 討論結論(living doc,實作前會再細化)
- 來源規範:《AI 自動分類知識系統 Demo 防濫用與成本控管實作規範 v1.0》(2026-07-12,為 Next.js + Server API + PostgreSQL + Redis + 可選 Spring Boot 撰寫)
- 本專案實際技術棧:Vue 3 SPA + **Supabase**(Postgres + pgvector + Edge Functions + Auth + RLS)+ Claude Haiku 分類

> 目的:把上面那份「為 Next.js/Redis 寫的」資安規範,對應到本專案實際用的 Supabase,判定可行性、標出要換的做法與真實風險,並記錄落地階段規劃。作者對 Supabase 不熟,本文兼作學習與決策依據。

---

## 0. 總判定

**可以照規範走,約 85% 能乾淨對應。** 兩處要換做法(Redis→Postgres、SSRF 在 Deno 上自幹),一個前提改變全局(見 §1)。規範 §20 的五張稽核表是純 Postgres,直接搬進 Supabase migration。#1 鐵律(API key 只在 server 端)現況**已做對**。

---

## 1. 改變全局的前提:本專案的威脅模型與原規範不同 ⭐

原規範假設「**對外公開 Demo、任何匿名者可觸發 AI**」,所以有一半在防殭屍網路 / 帳號農場 / 匿名限流 / Turnstile。

本專案目前設計:

- **訪客 = mock**:分類走關鍵字啟發式,**零 AI API 呼叫**(`services/dataMode.isMock()` 分流)。
- **真 Claude 只對登入的擁有者(作者本人)觸發**。

⇒ AI 花費目前只有**一個受信任使用者**。規範因此拆成兩層:

| 層級 | 控制項 | 現在該做? |
|---|---|---|
| **A. 單一使用者也必須做** | API key server 端、成本硬上限(日/月 USD)、Kill Switch、逾時 + 禁自動重試風暴、輸出 token 上限、Structured Output 驗證 + 分類 allowlist、SSRF、Prompt Injection 隔離、輸入長度限制、Idempotency、不含密鑰的 log + 成本稽核 | **是**——單帳號一樣會因重試風暴 / 巨量輸入 / 供應商異常而爆帳(對應威脅 T02/T06/T12/T13) |
| **B. 開放公開帳號才必須** | Turnstile、匿名 / per-IP 限流、WAF Edge 限流、全站併發上限、Abuse score、註冊/登入限流 | **可延後**——等 Google OAuth 開放他人註冊(多租戶)那天再上 |

**決策原則:A 層現在做;B 層先把資料表 schema 設計好,控制邏輯等真的開放公開帳號再啟用。**

---

## 2. 架構對照表(規範 → Supabase)

| 規範(Next.js + Redis + WAF) | 本專案(Supabase) | 判定 |
|---|---|---|
| Next.js Server API `/api/classify` | Edge Function `supabase/functions/ingest`(Deno) | ✅ 已存在,同角色 |
| API key 在 server env | `supabase secrets set ANTHROPIC_API_KEY` | ✅ **已做對** |
| 前端絕不直呼 AI | 前端只 POST `/ingest`,從不碰 Anthropic | ✅ 設計即如此 |
| PostgreSQL 稽核表(§20) | Supabase Postgres | ✅ **1:1 對應**,直接搬 |
| Redis 原子計數 / 限流 / 併發旗號 | **無 Redis** → Postgres 原子 SQL,或加 Upstash Redis(HTTP) | ⚠️ 需決策(§3.1) |
| WAF / Edge 限流(Vercel/Cloudflare) | Vercel(前端)+ Cloudflare 擋前面;Supabase 平台限制較陽春 | △ 外部、部分 |
| Turnstile siteverify(server 端) | Edge Function 內 `fetch()` 呼 siteverify | ✅ 可行 |
| 預算保留交易(`FOR UPDATE`) | Postgres 交易(Edge Function 用 service role) | ✅ 可行 |
| Kill Switch(env / feature_flags) | Edge env var + `feature_flags` 表 | ✅ 可行 |
| SSRF URL fetcher(DNS + IP 驗證) | Deno `fetch` + `Deno.resolveDns` + IP 檢查 | ⚠️ **最難**(§3.2) |
| Structured Output(Zod) | Deno 也能跑 Zod | ✅ 可行 |
| Global exception / 錯誤碼 | Edge Function try/catch + 統一錯誤碼 | ✅ 可行 |
| 角色 ANON/FREE/TESTER/PAID/ADMIN | Supabase Auth + `profiles.role` 欄位 / JWT claim | ✅ 可對應 |

---

## 3. Supabase 專屬的 4 個真實 gap

### 3.1 沒有 Redis(限流 / 併發 / 預算原子性)

規範用 Redis `INCR+EXPIRE` / Lua 做原子限流與全站併發旗號。兩條路:

- **(a) Postgres-only**:`rate_limit_counters` 表 + `INSERT … ON CONFLICT (key) DO UPDATE SET count = count+1 … RETURNING count`;預算用 `SELECT … FOR UPDATE` 鎖每日 usage 列(對應規範 §21 交易範例)。**正確且原子**,代價是 DB 負載與列競爭。
- **(b) 加 Upstash Redis**:HTTP REST API,可從 Edge Function 直接呼叫,有免費額度,幾乎照抄規範。

**建議:單人 / 自用階段先用 (a) Postgres-only**(少一個服務、夠用);真開放公開帳號、量體上來再換 (b)。

### 3.2 SSRF 在 Deno Edge 上要自己實作(最燒腦)

使用者可提交 URL → Edge Function 在 server 端 fetch → 高風險。必做:`Deno.resolveDns` 解析後逐一檢查是否 private/reserved/link-local/multicast/`169.254.169.254`(雲端 metadata)、每次 redirect 重新驗證(`redirect: 'manual'`)、限 bytes / 逾時 / 跳數、Content-Type allowlist、擋非 80/443 port、擋 `user:pass@`。容易出的細節漏洞:DNS rebinding、IPv4-mapped IPv6。

**逃生口(規範 §34 Phase 1 明載):不開放 URL 輸入,就完全不需要 SSRF,只收貼上的純文字。**

**建議:Phase 2a 先做「純文字分類」,把成本 / Kill Switch / 驗證先上線;Phase 2b 才加 URL 擷取 + 完整 SSRF 模組。** 分段學這塊,不卡 AI 功能主線。

> **落實狀態(2026-07-16,`/extract` function)**:上列要求的落實對照——
> `Deno.resolveDns` 分族解析(A/AAAA 分開,單族 NODATA 通過,所有取得 IP
> 逐一驗)✅、redirect 逐跳重驗 ✅、bytes / 逾時 / 跳數上限 ✅、
> Content-Type allowlist ✅、擋非 80/443 port ✅、擋 `user:pass@` ✅、
> IPv4-mapped IPv6 與十進位 / 十六進位 / 八進位 IP 編碼正規化 ✅
> (規格與驗收:`docs/proposals/link-meta-no-ai.md` H1)。
> **殘餘風險(接受,明寫)**:DNS rebinding TOCTOU——Deno `fetch` 不支援
> connect-to-IP pinning,resolve 與 fetch 間存在極小時窗(TTL=0 惡意 DNS
> 可利用);以「解析緊貼 fetch + 每跳重驗」為 edge runtime 可達上限。

### 3.3 Edge Function 執行時間 / CPU 上限

Supabase Edge Function(Deno)有 wall-clock / CPU 上限(依方案)。單次分類(URL ≤10s + AI ≤25s)放得下,但**必須自己設 `AbortSignal.timeout()`**(規範已給數值:fetch 10s、AI 25s)。冷啟動增加延遲,Demo 可接受。

### 3.4 前端直連 DB 改變了信任邊界

不像 Next.js 全部走自家 server,supabase-js 讓瀏覽器**直接讀寫資料表**(靠 RLS 守)。含意:

- 非 AI 資料直連 + RLS 沒問題。
- **凡是會花錢的操作(AI)必須只走 Edge Function**,絕不能做成「insert 觸發 DB 端 AI」的 Postgres trigger——那會繞過所有預算 / 限流閘門。現況已把 AI 收斂在 `/ingest`,守住了。
- **加分**:RLS(`auth.uid() = user_id`)在 DB 層就達成規範的「敏感路徑必經邏輯層」資料隔離,這是規範(純 Next.js)沒有的。但 **RLS 不限流、不擋預算**,那些仍靠 Edge Function 閘門。

---

## 4. 目前 `/ingest` 骨架的待修點(Phase 2 必修)

現況用 **service role key(繞過 RLS)** 但缺閘門:

- [ ] **驗證呼叫者 JWT、從中取 `user_id` 再寫入**——不可信 body 帶進來的身分(現在 insert 甚至沒設 user_id)。
- [ ] **CORS 從 `*` 收斂**成 app origin。
- [ ] 加成本硬上限閘門(Postgres 交易,§3.1a)。
- [ ] 加 Kill Switch(env `AI_GLOBAL_KILL_SWITCH` + `feature_flags`,API 第一段就檢查)。
- [ ] 加輸入長度限制 + 逾時 + 禁自動重試(最多 1 次)+ 最大輸出 token。
- [ ] 接 Claude 後:Zod 驗證結構化輸出 + 主分類 allowlist(不合就 fallback,不硬失敗)。
- [ ] Idempotency:`ai_requests(user_id, idempotency_key)` unique index。
- [ ] Prompt injection 隔離:外部內容包在 `UNTRUSTED_CONTENT_START/END`,System Prompt 明令不執行其中指令、不外洩 prompt/密鑰、只輸出指定 JSON。
- [ ] 寫 `security_events` / `ai_usage_daily`,log 不含密鑰 / 完整 prompt / 完整使用者內容。

---

## 5. 落地階段規劃(對應規範 §34,依本專案調整)

- **Phase 2a — 純文字真 AI(擁有者)**:= 規範 Phase 1 MUST 去掉 URL/SSRF。
  secrets ✅ → JWT-auth Edge Function + 設 user_id + 收斂 CORS → 成本日/月硬上限(Postgres 交易)→ Kill Switch → 輸入長度 + 輸出 token + 逾時 + 禁重試風暴 → Zod 結構化輸出 + 分類 allowlist → Idempotency → `ai_usage_daily`/`security_events` → Prompt injection 硬化。
- **Phase 2b — URL 擷取**:SSRF safe-fetch 模組(DNS+IP 驗證、redirect 重驗、bytes/時間/跳數上限、Content-Type allowlist)。
- **Phase 3 — 開放公開帳號 / 作品集「試玩」**:Turnstile、per-IP / 匿名限流、全站併發上限、WAF(Cloudflare/Vercel)、Abuse score、註冊/登入限流。= 規範「Phase 2 公開 Demo」層。

---

## 6. 要新增的資料表(migration 0007+,直接取自規範 §20)

純 Postgres,drop-in:

- `ai_requests`(每筆請求 + 狀態機 + token/成本 + `UNIQUE(user_id, idempotency_key)`)
- `ai_usage_daily`(全站每日呼叫數 / 保留成本 / 實際成本)
- `user_ai_quota_daily`(每使用者每日額度)
- `security_events`(限流/SSRF/Turnstile/prompt-injection… 稽核)
- `feature_flags`(Kill Switch:`ai_classification_enabled`)

RLS:稽核表僅 service role(Edge Function)可寫;使用者頂多讀自己的 usage。

---

## 7. 待拍板的決策

1. **限流/預算原子性**:Postgres-only(建議,先)還是加 Upstash Redis?
2. **URL 擷取**:Phase 2a 先純文字(建議),還是一次做到 URL + SSRF?
3. **是否開放公開帳號**:若是作品集「訪客試玩真 AI」,則 B 層(Turnstile/WAF/匿名限流)升為 MUST;若 AI 永遠只給擁有者,B 層可長期不做。

---

## 8. 對應威脅速查(規範 §3 → 本專案現況)

| 威脅 | 現況 | 對策落點 |
|---|---|---|
| T01 API Key 外洩 | ✅ 已 server 端 | 維持;CI secret scan |
| T02 後端 API 濫用 | ⚠️ `/ingest` 無閘門 | Phase 2a 成本上限 + 限流 |
| T03/T04 帳號農場 / IP 輪替 | N/A(owner-only) | Phase 3(開放才需要) |
| T05 併發爆量 | ⚠️ | Phase 2a 全站每日上限;Phase 3 併發旗號 |
| T06 巨量輸入 | ⚠️ | Phase 2a 輸入長度 + 輸出 token 上限 |
| T07/T08 SSRF | ⚠️ 未開 URL 前無曝險 | Phase 2b safe-fetch |
| T09 Prompt Injection | ⚠️ | Phase 2a prompt 硬化 |
| T10 不安全輸出 | ⚠️ | Zod 驗證 + 前端純文字渲染(不 `v-html`) |
| T11 重放 | ⚠️ | Phase 2a Idempotency |
| T12 重試風暴 | ⚠️ | Phase 2a 禁自動重試 |
| T13 供應商異常 | ⚠️ | Phase 2a 逾時 + 保留成本回沖 |
| T15 隱私外洩 | ⚠️ | log 遮罩 + 送出前 UI 提示 |

---

## 來源與延伸

規範正本第 40 節列的官方依據(OpenAI API Key safety、Turnstile server-side validation、OWASP API Security URC、OWASP SSRF Cheat Sheet、OWASP GenAI Prompt Injection、Next.js env vars/data security 等)同樣適用;差別只在「你的 server 是 Supabase Edge Function 而非 Next.js Route Handler」。
