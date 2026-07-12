-- Seed category definitions (PLAN.md §3.3).
-- These are DATA: add new categories here (or via the app once category
-- management lands), no code changes needed.

insert into type_definitions (key, name, domain, description, attrs_schema) values
('food', '美食', '生活',
 '餐廳、小吃、咖啡廳等飲食相關的店家資訊',
 '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}'),
('attraction', '景點', '生活',
 '旅遊景點、展覽、活動場所',
 '{"城市":"string","地址":"string","門票":"string","建議停留":"string"}'),
('travel_info', '出國旅遊資訊', '生活',
 '簽證、機票、當地交通、住宿等出國相關實用資訊',
 '{"國家":"string","類別":"enum:簽證/交通/住宿/其他"}'),
('ai_skill', 'AI agent 技能', '技術',
 'AI 工具、agent 技巧、prompt 手法、MCP/skill 相關資源',
 '{"工具名":"string","用途":"string","官網":"string","費用":"string"}'),
('frontend_snippet', '前端片段', '技術',
 '前端技巧、CSS 手法、Vue 元件模式、UI 範例',
 '{"框架":"string","難度":"enum:入門/中階/進階","demo_url":"string"}'),
('backend_skill', '後端技能', '技術',
 '後端框架、API 設計、資料庫、部署相關知識',
 '{"技術棧":"string","難度":"enum:入門/中階/進階"}')
on conflict (key) do nothing;
