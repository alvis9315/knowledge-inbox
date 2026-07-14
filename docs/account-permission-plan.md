# 帳號權限功能規劃(2026-07-14)

> 回答「為什麼有登入卻沒有註冊/帳號管理」,並規劃完整的帳號權限演進路線。
> 關聯:`auth-and-login.md`(現況)、`security-guideline.md`、`security/ai-cost-abuse-supabase.md`。

## 0. 現況盤點(誠實版)

| 能力 | 狀態 | 說明 |
|---|---|---|
| 登入(Email/Google/訪客) | ✅ | 訪客=mock 零雲端 |
| per-user 資料隔離 | ✅ | entries / bg_presets / collections(0011)RLS = `auth.uid()=user_id` |
| 註冊 UI | ❌ 刻意不做 | 單人工具:開放註冊=陌生人資料寫進你的 DB |
| **註冊 API** | ⚠️ **預設是開的** | 沒做 UI ≠ 關掉功能:任何人拿 anon key(部署後公開)就能呼叫 `signUp` 建帳號 |
| 帳號管理(啟用/停用) | ❌ | 目前只能 Dashboard 手動 |
| **分類樹/標籤租戶隔離** | ❌ **全域共享** | `type_definitions`/`tags`/`domain_meta` 無 user_id,policy 是 authenticated 全放行——第二個使用者會看到並可改你的 63 個分類 |

**兩個核心結論**:
1. 「沒有註冊」的設計意圖沒有貫徹到平台層——**API 層還開著**,要去 Supabase 關
2. 多人化的真正阻礙不是註冊 UI(那是一天的事),是**資料層租戶化**(分類樹/標籤誰的歸誰)

## Phase A:自用期(立刻做,成本≈0)

1. **關閉開放註冊**(prod 與 dev 都關):Dashboard → Authentication → Sign In / Up →
   關閉「Allow new users to sign up」。關掉後 `signUp` API 回錯誤,帳號只能由
   Dashboard(Add user)或未來的 admin 流程建立——設計意圖與平台設定一致
2. 帳號建立/停用照舊走 Dashboard:Add user(勾 Auto Confirm)/ Ban user
3. 本階段**不做**前端註冊與帳號管理 UI(單人用不到,做了是過度初始化)

## Phase B:開放第二個使用者之前(資料工程,最大塊)

> 觸發條件:決定給任何第二個人真帳號(家人/朋友/測試者)。沒做完以下不得發帳號。

1. **租戶化 migrations(0012+)**:
   - `type_definitions`、`tags`、`domain_meta` 加 `user_id` + RLS owner policy
   - 既有資料回填給 owner(= 你);種子分類樹改為「範本表」或複製機制
2. **onboarding 流程**:auth.users insert trigger → 建 `profiles` 列 + 複製預設分類樹給新使用者
3. **`profiles` 表**:`user_id PK, display_name, role('admin'|'member'), status, created_at`
   ——role 是之後所有管理功能的權限依據
4. 自學字典 DB 化(`classification_feedback`,per-user)——roadmap 既有項目,順勢併入
5. 重驗 RLS:兩個測試帳號互相看不到對方任何資料才算過關

## Phase C:產品化(盈利/多人期)

1. **註冊 UI**:email 驗證、使用條款、(可選)邀請碼制——配合 Supabase Attack
   Protection(rate limit / captcha)
2. **帳號管理後台**(admin only):
   - 使用者列表(profiles + 用量統計)
   - 啟用/停用:`auth.admin.updateUserById({ banned_until })` 需 service role →
     走 Edge Function `admin-users`,函式內驗 JWT 且 `profiles.role='admin'` 才放行
   - 刪除帳號:cascade 清資料(0010/0011 的 FK 已設 on delete cascade,新表照做)
3. 訂閱方案 + AI 成本控管:`security/ai-cost-abuse-supabase.md` 全套上線

## 技術機制備忘

- **停用帳號**的唯一正道是 Auth Admin API(service role)——絕不能放前端;
  Edge Function 是 service role 的唯一合法住所
- **role 判定**在 `profiles.role`,Edge Function 與 RLS policy 都以它為準
- 訪客模式不受本規劃影響:它永遠是純前端 mock,零帳號零雲端
