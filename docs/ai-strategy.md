# AI 接入策略 — 兩條路線與無 API 替代方案

- 建立日期:2026-07-13
- 背景:與友人(同樣做「丟連結即處理」知識整合系統、有 BYOK 與付費串 API 實戰經驗)討論後定調。
- 關聯文件:`docs/security/ai-cost-abuse-supabase.md`(接 API 時的資安/成本控管)

## 定調(2026-07-13)

1. **自用期不接付費 AI API**。分類/摘要走無 AI 替代方案(見下)。
2. **盈利/多人期再接**:届時走 `docs/security/` 那份規範(成本硬上限、Kill Switch…);考慮 **OpenRouter** 聚合(一個 key 多家模型、量大較省)。
3. **中間態備案:BYOK**(使用者填自己的 key 用我們的系統)——多人但不想自付成本時的選項;坑:key 驗證、額度歸屬、錯誤歸咎、代管責任,真要走再細規劃。
4. 架構不變:`classifyText` 介面當初即為抽換設計,路線切換不動呼叫端。

## 無 AI API 替代方案(按投報率)

### 1. 規則分類器 v2(第一優先)
- **網域 → 分類對照表**:連結型輸入主力(youtube→社群、tabelog→美食、github→學習、104→求職…)。
- **關鍵字加權字典**:每子分類掛權重詞,取最高分;低分 → `pending_review`(沿用 confidence 分流)。
- **回饋自學**:待確認畫面的人工修正寫入 `classification_feedback`,自動把該文字關鍵詞加權進字典 → 越用越準。積木原則第 5 條的無 AI 版。

### 2. URL metadata 擷取(無 LLM 的標題/摘要)
- 抓 `og:title` / `og:description` / `meta keywords` 當標題與摘要,純 HTML 解析。
- 需 server 端 fetch → SSRF 防護仍要(規模較小);配合網域表,「丟連結自動歸檔」體驗約八成。

### 3. 本地 embedding 相似度(加強層,非第一步)
- `transformers.js` 瀏覽器跑量化多語 embedding(如 multilingual-e5-small ~30MB),輸入與子分類描述算相似度。
- 零 API 費、隱私佳、可接 pgvector;缺點:首載模型較大、中文短文本準度中等。

### 4. 本地 LLM(Ollama)— 自用限定
- Owner 模式在本機打 `localhost:11434`,品質近雲端小模型、免費。
- 限制:僅自己電腦開著時可用,部署 demo 用不到。自用期選配。

## 對照表

| | 現在(自用) | 未來(盈利) |
|---|---|---|
| 分類 | 規則 v2 + (選)embedding | Claude / OpenRouter |
| 標題/摘要 | og metadata | LLM 摘要 |
| 多人不自費 | — | BYOK |
| 資安 | SSRF(若開 URL 擷取) | `docs/security/` 全套 |

## 連結類型 extractor 對照(2026-07-13 補)

架構:**per-網域 extractor registry**(設定當資料管理),通用 fallback = og tags → `<title>` → URL 字串。

| 類型 | 做法 | 備註 |
|---|---|---|
| 一般網頁/部落格 | og:title/description,無則 title+readability | 最容易 |
| YouTube | 官方 oEmbed(免費無 key)→ 標題/頻道/縮圖 | 一個 GET |
| Google Maps | 展開短網址 → 店名在最終 URL path,decode 即得 | 評分/營業時間才需 Places API,先不用 |
| IG / Threads / FB | **登入牆,抓不到內容**(接付費 API 也一樣) | URL 即分類訊號:→社群+@帳號;摘要靠使用者補 |
| X/Twitter | 官方 oEmbed 拿推文文字 | 尚可用 |
| 電商(蝦皮…) | og,反爬兇則 fallback | 看臉 |
| 短網址 | 先 follow redirect 展開再分流 | 注意 SSRF |

**硬限制**:URL 擷取必須 server 端(瀏覽器 CORS 擋跨域抓頁)→ 此功能依賴 Supabase Edge Function,**純前端 mock 模式做不到**(mock 只能做 URL 字串網域判斷)。

## 分類器優化 roadmap(2026-07-13,回答「要不要建網址對應表」)

丟連結辨識**不必也不該窮舉所有網站**——對應表分兩層,一層手寫、一層自己長:

1. **靜態種子表**(`ruleClassifier.ts` 的 `DOMAIN_RULES`):只放大宗網站(YT/IG/tabelog/104/github…),遇到常用新站值得時再手動補一條。
2. **自學表(自動長出來的)**:未知網站(如 figurelist.co)第一次進待確認 → 人工指定分類 → `learnFromCorrection` 把 **hostname 以強權重**記進 localStorage → **同網站下次直接自動歸檔**。用得越久,你的個人網址對應表越完整——不用手維護。
   - 2026-07-13 修正:hostname 學習權重 +3、評分吃全額(原本要修正 3 次才自動,現在 1 次)。

後續優化順序:
- [x] **自學字典管理 UI**(齒輪選單):檢視/刪除已學的網址對應與關鍵詞(學錯可修)。✅ 2026-07-14
- [x] 自學權重搬進 DB(`learned_weights`,0012)→ 跨裝置、不怕清瀏覽器。✅ 2026-07-15(改用獨立表比照 bg_presets,非原規劃的 classification_feedback)
- [x] og 擷取的**網頁標題/描述已進評分**(QuickCapture 的 classifyInput 串接 meta.title + description)。✅ 盤點時發現早已完成,勾選過時(2026-07-15 更正)
- [ ] (選配)Ollama 第三層:規則沒把握的才丟本地 LLM。

## 友人系統的模式(參考)

友人 = 可收費產品 → 大膽串付費 API(品質優先),菜單圖片擷取為雲端 vision 模型(Fable 是開發工具寫 code,非 runtime);非自建 LLM。我們自用期對應解:規則 + 本地 Ollama(RTX 4070 跑 7B 級綽綽有餘;vision 任務 qwen2.5-vl 亦可,品質次於雲端)。

## 主題風格 × react-bits Backgrounds 移植 roadmap(2026-07-14)

架構已就緒:`ThemePreset.liveBg`(themePresets.ts)決定該主題鋪哪種活背景,
AppShell 依當前大類別的主題渲染(fixed 層;調參時升 z-40 全螢幕預覽);
控制器按鈕 `BgControlsButton`(視圖 icon 左)全域開關 `liveBgControls.ts`。

**已完成 36 種**(至 2026-07-15 第二班,零依賴組全清 + three/gsap 批 8 顆):galaxy(星空)、
threads(線條)、image(圖片封面)、aurora(極光)、waves(波浪)、
darkveil(暗湧)、silk(絲綢)、iridescence(虹彩)、letterglitch(字符雨)、
lightning(閃電)、liquidchrome(液態鉻)、particles(漂浮粒子)、
ripplegrid(漣漪網格)、orb(能量球)、plasma(電漿)、dotfield(點陣)、
softaurora(柔光極光)、lightrays(光束)、grainient(顆粒漸層)、
radar(雷達)、linewaves(波線)、siderays(斜射光)、lightfall(光瀑)、
evileye(魔眼)、shapegrid(幾何格線)、prism(稜鏡)、
prismaticburst(彩光爆發)、faultyterminal(故障終端)、
gridmotion(卡片牆,gsap)、dotgrid(慣性點陣,gsap+Inertia)、
lightpillar(光柱,three)、colorbends(彎折色帶,three)、
griddistortion(封面扭曲,three,圖源=登入封面)、pixelsnow(像素雪,three)、
floatinglines(漂浮波線,three)、dither(復古抖動,three+postprocessing)。

**移植紀律**(夜班確立):零依賴優先(ogl 或純 canvas);
一律 `defineAsyncComponent`(主包零成長);掛載四件套 =
元件 + Controls + LiveBgKind + THEME_PRESETS + **registry 一行**
(2026-07-14 起 AppShell 改 registry 驅動,見 backgrounds/registry.ts)。

**零依賴組已全數移植完畢**(2026-07-15)。

**three/gsap 批**(2026-07-15 使用者拍板引入,依賴全走 async chunk:
three 為共享 lazy chunk 126KB gzip、gsap 30KB gzip,主包零成長已驗證):
已完成 8 顆(見上)。**剩餘待移植**:PixelBlast(three+postprocessing)、
Beams(R3F 需改寫原生 three)、Hyperspeed(1183 行,最大顆)。
GridScan 不做(還要 face-api.js)。

**移植教訓**(2026-07-15):FaultyTerminal 黑畫面根因 = 照抄元件預設值
(noiseAmp=0)而非官方 demo 值(=1)——之後移植以 demo 的 props 為
視覺基準,元件預設僅供對照。
