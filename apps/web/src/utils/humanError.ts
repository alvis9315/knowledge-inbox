/**
 * 錯誤訊息轉譯:使用者永遠只看到「明確中文語意」的訊息,絕不顯示
 * 程式碼/API 原始錯誤(那些只進 console 供除錯)。
 * 規則:比對已知模式 → 對應中文;比不到 → 用呼叫端給的情境 fallback。
 */
const RULES: Array<[RegExp, string]> = [
  [/could not find the table|relation .* does not exist|schema cache/i, '資料庫尚未更新到最新版本,請先套用最新的資料庫更新(migrations)再試'],
  [/invalid login credentials/i, 'Email 或密碼錯誤,請重新輸入'],
  [/email not confirmed/i, '這個帳號尚未完成 Email 驗證'],
  [/user already registered/i, '這個 Email 已經註冊過了'],
  [/failed to fetch|network|fetch failed|load failed/i, '網路連線異常,請檢查網路後再試'],
  [/duplicate key|unique constraint/i, '已有相同的資料,請換個名稱'],
  [/permission denied|row-level security|not authorized|403/i, '沒有權限執行這個操作,請重新登入後再試'],
  [/jwt|token .*expired|session/i, '登入已過期,請重新登入'],
  [/timeout|timed out/i, '連線逾時,請稍後再試'],
]

export function humanError(e: unknown, fallback = '操作失敗,請稍後再試'): string {
  const raw = e instanceof Error ? e.message : String(e)
  console.error('[error]', e)
  // 已經是中文的訊息 = 我們自己拋的人話,直接放行(不被泛化 fallback 蓋掉)。
  if (/[぀-ヿ一-鿿]/.test(raw)) return raw
  for (const [re, msg] of RULES) if (re.test(raw)) return msg
  return fallback
}
