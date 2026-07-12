# API Spec

前端主要透過 `supabase-js` 直接查 Postgres(PostgREST 自動 API),不另建 REST 層。
唯一自建端點是 ingest pipeline。

## POST /ingest(Supabase Edge Function)

所有入口(網頁 / LINE bot / PWA)共用的唯一寫入端點。

- **URL**: `https://<project-ref>.supabase.co/functions/v1/ingest`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <anon-or-user-jwt>`、`Content-Type: application/json`

### Request body

```json
{
  "content": "純文字內容,或搭配 source_url",
  "source_url": "https://example.com/...   // 選填"
}
```

`content` 與 `source_url` 至少要有一個。

### Response

**201 Created**(目前 Phase 1 骨架:寫入 `pending_review`,尚未接 LLM)

```json
{
  "ok": true,
  "entry": { "id": "uuid", "status": "pending_review" },
  "note": "Filed as pending_review (LLM classification not yet wired — Phase 2)."
}
```

**Phase 2 目標回應**(接上 Claude Haiku 後)

```json
{
  "ok": true,
  "entry": {
    "id": "uuid",
    "type": "food",
    "title": "…",
    "confidence": 0.92,
    "status": "filed"
  }
}
```

### 錯誤

| 狀態 | 意義 |
|---|---|
| 400 | body 非 JSON,或 content / source_url 皆空 |
| 405 | 非 POST |
| 500 | DB 寫入錯誤 |
| 501 | Edge Function 未設定(缺 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) |

### 環境變數(Edge Function secrets — 絕不進前端)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由平台自動注入
```

### LLM 分類契約(Phase 2,Claude 回傳的結構化 JSON)

```json
{
  "type": "符合的 type key,都不符合填 'new'",
  "new_type_proposal": { "key": "", "name": "", "domain": "", "description": "", "attrs_schema": {} },
  "confidence": 0.0,
  "title": "簡短標題",
  "attrs": { "依該 type 的 attrs_schema 抽取" },
  "tags": ["3-5 個標籤"],
  "summary": "一句摘要"
}
```
