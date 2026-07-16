# 提案:extract 管線強化(不串 AI 的連結解析,自動填名稱+分類)

狀態:**已完成並部署**(2026-07-17)。v3.1 經 Codex 4 輪 adversarial review
approve;H4=c374654、H1+H2+H3+測試=3d976b5、YouTube oEmbed 直連修正=e7ac602
(部署時實測發現機器人牆,見下方部署後記)。dev+prod 均為 e7ac602 版,
dev 煙霧測試通過(YouTube 真標題 + 分類進學習/AI 技能)。

**部署後記(教訓)**:
1. Dashboard「Via Editor」的 slug 是建立時定死的,事後改名只改顯示名稱
   ——slug 錯了前端 invoke 永遠 404,建立時名稱欄就要填 extract
2. 機房 IP 抓 youtube 頁面被 302 到 google.com/sorry:YouTube 一律
   oEmbed 直連,任何連結落到 /sorry 回 502 不冒充

## 背景與現況(v1 的錯誤更正)

v1 提案誤判「功能尚未實作」。實際現況:**完整管線已存在**——

- `supabase/functions/extract/index.ts`(155 行):登入驗證 → URL 驗證 →
  redirect 手動展開(≤3 跳,逐跳重驗)→ YouTube oEmbed(伺服器端,無
  CORS 問題)→ Maps 店名 → og:title/description/`<title>`;8s 逾時、
  1MB 上限、僅 text/html
- `apps/web/src/services/extract.ts`:前端封裝,mock 模式回 null(訪客
  零外部請求前提已滿足)
- `QuickCapture.vue:51-69`:貼連結 → `await extractUrl` → 標題自動填入
  (`meta.title`)、描述併進 `classifyText` 輸入

**所以「自動填名稱+分類」不需要新做**;本提案 = 讓它安全上線的
強化清單。v1 的「新增 link-meta function」「oEmbed 走前端 CORS」全部作廢
(oEmbed 在伺服器端,CORS 不適用)。

## 施工順序(H4 文件先行,依「改架構先改圖」鐵律)

**H4 → H1 → H2 → 使用者部署 → 驗證 → H3**

## H4. 文件同步(第一步,程式動工前)

- docs/architecture.md:唯一伺服器入口「ingest」的宣稱已失真,補上
  extract Edge Function 節點與資料流(QuickCapture → extract → og/oEmbed)
- PLAN.md:「URL 擷取尚未實作」段落更新為已實作+強化中
- docs/security/ai-cost-abuse-supabase.md:Phase 2b 對 extract 的要求
  (resolveDns/非 80/443 port/redirect 重驗)標注本提案的落實狀態與
  殘餘風險(H1 的 rebinding TOCTOU)

## H1. SSRF:DNS 層防護 + port allowlist(high,部署門檻)

現況 `validateUrl` 只擋 hostname 字面(localhost/.local/.internal/IP
literal),缺口:
- 公開網域 A/AAAA 記錄指向 127.0.0.1、10.x、fd00::/8 等(DNS 指內網)
- redirect 每跳只重驗 hostname 字面,同樣繞得過
- 非點分十進位 IP 編碼:`http://2130706433/`(十進位)、`http://0x7f000001/`
  不符現有 IPv4 regex,直接放行
- **port 完全沒驗**:`http://1.2.3.4:8080`、redirect 到 `:6379` 都放行,
  可被當任意 TCP/HTTP 探測代理(security 文件 Phase 2b 本來就要求擋)

**作法**(初始 URL 與每一跳 redirect 都做):
1. **port allowlist**:effective port 僅允許協定預設(http=80、
   https=443);URL 明寫其他 port 一律 400
2. hostname 若為任何編碼的 IP(dotted / 純數字十進位 / 0x 十六進位 /
   0 開頭八進位 / IPv6 / v4-mapped v6 拆出內嵌 v4)→ 正規化成 IP 後
   走第 4 步檢查
3. hostname 為網域 → `Deno.resolveDns(host, 'A')` 與 `'AAAA'` **分別**
   解析(Supabase Edge Runtime 支援):單一族群 NODATA/NotFound 屬正常
   (IPv4-only / IPv6-only 網站都合法),**至少取得一個位址**即繼續;
   兩族群皆無位址或真正 DNS 錯誤才 400。**所有**取得的 IP(不分族群)
   都須通過第 4 步,任一內網即 400
4. IP 黑名單(完整保留段):
   - v4:0.0.0.0/8、10/8、100.64/10(CGNAT)、127/8、169.254/16
     (含雲端 metadata 169.254.169.254)、172.16/12、192.0.0/24、
     192.0.2/24、192.168/16、198.18/15、198.51.100/24、203.0.113/24、
     224/4、240/4、255.255.255.255
   - v6:::、::1、::ffff:0:0/96(內嵌 v4 拆出重驗)、fc00::/7、
     fe80::/10、2001:db8::/32、ff00::/8
5. 解析緊貼在 fetch 之前執行,縮小 rebinding 時窗

**已知殘餘風險(明寫,不假裝解決)**:Deno `fetch` 不支援
connect-to-IP pinning,resolve 與 fetch 之間存在極小 TOCTOU 時窗
(DNS rebinding with TTL=0)。完整 pinning 需自建 socket 層,edge
runtime 不可行;以「解析緊貼 fetch + 每跳重驗」為可達上限,殘餘風險
記入 docs/security(H4 一併寫)。

**驗收測試**——預期 400:redirect-to-private、`http://2130706433/`、
`http://0x7f000001/`、v4-mapped v6、resolveDns 多筆其中一筆內網、
`http://example.com:8080/`、`https://example.com:8443/`、
redirect 到非標準 port、A+AAAA 兩族群皆無位址。
預期通過:IPv4-only 網域(AAAA NODATA)、IPv6-only 網域(A NODATA)。

## H2. 端到端 deadline + submit 防重入(high)

現況兩個問題:
- 最壞路徑 expand 每跳 8s × 3 跳 + 最終頁再 GET 8s ≈ 32s,「儲存中」
  同步卡住;且 expand 已 GET 最終頁一次、step 4 又重複 GET 同一頁
- **submit 無重入保護**:`saving` 只 disable 按鈕,鍵盤快捷鍵
  (Meta/Ctrl+Enter)直呼 submit,在第一次 `await extractUrl` 期間
  連按會並行執行兩次 `createEntry` → 重複資料

**作法**:
1. function 端:整體預算單一 `AbortSignal.timeout(6000)` 貫穿所有 fetch
   (取代每跳獨立 8s)
2. **消除重複 GET**:expand 走到 2xx 時直接回傳該 Response 給 step 4
   重用 body,不再抓第二次
3. 前端:`extractUrl` 以 `Promise.race` 加 3s 上限,逾時回 null →
   照原樣存(標題=原文字);**不做背景補寫**(避免多儲存層追加
   同步策略——依鐵律每個變更動作明確歸類,此處選「放棄該次擷取」)
4. **`submit` 開頭加 `if (saving.value) return`**(明列施工項目,
   不是驗收願望)

**驗收測試**:慢站(sleep 10s)逾時後儲存仍成功且標題=原輸入;
3 跳 redirect 慢站;以可控 deferred extract promise 模擬擷取進行中,
按鈕提交 + Meta/Ctrl+Enter 混合連發 → `createEntry` 僅被呼叫一次。

## H3. 分類收益:標題要真的參與評分(medium)

現況 `ruleClassifier` 對 YouTube 命中 nameHint 直接 0.9 early-return;
其他社群網域把候選硬鎖在「社群」domain——就算拿到美食標題,影片也
永遠進社群。

**輸入契約(顯式,不靠字串長度猜)**:
- `classifyText(text, meta?: { title: string; description: string | null })`
- `ruleClassify(text, categories, opts?: { hasMeta: boolean })`
- QuickCapture 拿到 `meta` 時傳入;`hasMeta === true` 才啟用軟化規則,
  純 URL 行為 bit-for-bit 不變

**評分規則**(`hasMeta` 時):
- 通用多主題平台(youtube/youtu.be/IG/threads/tiktok/facebook)的
  DOMAIN_RULES 從「早退 0.9 / 硬圈定 domainScope」降為**軟訊號**:
  該 domain 每個分類 +1,所有分類都參與競爭
- 單主題網域(tabelog、github、104…)維持現行早退/圈定
- **決勝規則**:總分同分時,實質關鍵字命中(靜態 +2 / 分類名 +3 /
  自學詞)多者勝;仍同分取自學詞權重和高者;再同分維持現行順序
  (= domain 軟訊號永遠壓不過任何實質命中)

**驗收案例(用現有 taxonomy 與字典,標明三元組
type / confidence / status)**:
(filed 門檻沿用現行寫入契約 **`confidence > 0.85`**——QuickCapture 與
PLAN 皆為嚴格大於,本提案不改動)
1. YouTube 標題「東京壽司丼飯開箱」(壽司+2、丼+2 → food_japanese
   4 分+社群軟訊號不及)→ type=food_japanese、confidence=0.95(capped)
   >0.85 → status=filed(自動歸檔)
2. YouTube 標題「壽司職人專訪」(僅壽司+2 → 0.8)→
   type=food_japanese、confidence=0.8 ≤0.85 → status=pending_review
   (**分類正確、低信心進待確認是預期行為**,不是失敗)
2b. confidence **恰為 0.85**(自學詞折半權重可組出,例:靜態 +2 加
   自學權重 1 折半 0.5 → score 2.5 → 0.85)→ status=pending_review
   (嚴格大於,邊界值不自動歸檔;單元測試鎖死)
3. YouTube 無擷取標題(extract 逾時)→ `hasMeta=false` → 行為同
   現狀:nameHint 早退,type=社群 YouTube 子分類、confidence=0.9、
   status=filed
4. tabelog 連結(有無 meta 皆)→ 行為不變(單主題早退)
5. 社群軟訊號 +1 與美食實質命中 +2 同時存在且總分同 → 依決勝規則
   判美食(單元測試鎖死)

## 上線順序(部署=使用者側動作)

1. H4 文件 → 2. H1+H2 施工、驗收過 → 3. 使用者
   `supabase functions deploy extract`(dev+prod)→ 4. 貼連結驗證
   自動填標題 → 5. H3 施工(純前端,隨時可上)

## 不做清單

- 背景補寫 metadata(H2 說明)
- IG/Facebook 深度擷取(og 擋爬蟲、oEmbed 要 token;靠自學字典)
- 前端直呼 oEmbed(v1 錯誤路線;一律走 extract function)
- port allowlist 之外的自訂 port 支援(收藏連結極少非標準 port,
  真遇到就存原樣不擷取)
