-- 0007 — 換上使用者實際的分類樹(2026-07-13)。
-- 移除 0002 的佔位 seed(技術/生活六類),種入 mock 模式定案的 7 大類別
-- / 63 子類別(apps/web/src/services/mock/seed.ts 為另一份正本,兩邊同步)。
-- 冪等:重跑只會 upsert,不會重複。

-- 1) 舊佔位類別:先解除引用再刪除(目前雲端幾乎無資料,安全)。
update entries set type = null
  where type in ('food','attraction','travel_info','ai_skill','frontend_snippet','backend_skill');
delete from type_definitions
  where key in ('food','attraction','travel_info','ai_skill','frontend_snippet','backend_skill');

-- 2) 使用者分類樹。順序 = 美食, 學習, 求職, 攝影, 社群, 日本旅遊, 國內旅遊。
insert into type_definitions (key, name, domain, description, attrs_schema, icon, color, sort_order) values
-- ── 美食 (#ea580c) ──
('food_cafe',      '咖啡廳',     '美食', '美食－咖啡廳',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '☕', '#ea580c', 10),
('food_cat_cafe',  '貓咪咖啡廳', '美食', '美食－貓咪咖啡廳', '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🐱', '#ea580c', 20),
('food_brunch',    '早午餐',     '美食', '美食－早午餐',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍳', '#ea580c', 30),
('food_izakaya',   '居酒屋',     '美食', '美食－居酒屋',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍶', '#ea580c', 40),
('food_italian',   '義式料理',   '美食', '美食－義式料理',   '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍝', '#ea580c', 50),
('food_japanese',  '日式料理',   '美食', '美食－日式料理',   '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍣', '#ea580c', 60),
('food_omakase',   '無菜單',     '美食', '美食－無菜單',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍱', '#ea580c', 70),
('food_buffet',    'buffet',     '美食', '美食－buffet',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍽️', '#ea580c', 80),
('food_dessert',   '甜點店',     '美食', '美食－甜點店',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍰', '#ea580c', 90),
('food_ice',       '冰品',       '美食', '美食－冰品',       '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🍧', '#ea580c', 100),
('food_drinks',    '飲料店',     '美食', '美食－飲料店',     '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🧋', '#ea580c', 110),
('food_western',   '西餐',       '美食', '美食－西餐',       '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🥩', '#ea580c', 120),
('food_chinese',   '中式料理',   '美食', '美食－中式料理',   '{"城市":"string","地址":"string","價位":"enum:$/$$/$$$","營業時間":"string","推薦品項":"string"}', '🥟', '#ea580c', 130),
-- ── 學習 (#2563eb) ──
('learn_ai',          'AI 技能',       '學習', '學習－AI 技能',       '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '🤖', '#2563eb', 140),
('learn_frontend',    '前端軟體技術',  '學習', '學習－前端軟體技術',  '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '🎨', '#2563eb', 150),
('learn_backend',     '後端軟體技術',  '學習', '學習－後端軟體技術',  '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '⚙️', '#2563eb', 160),
('learn_database',    '資料庫技能',    '學習', '學習－資料庫技能',    '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '🗄️', '#2563eb', 170),
('learn_uiux',        'UIUX',          '學習', '學習－UIUX',          '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '📐', '#2563eb', 180),
('learn_photoshop',   'Photoshop',     '學習', '學習－Photoshop',     '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '🖌️', '#2563eb', 190),
('learn_illustrator', 'Illustrator',   '學習', '學習－Illustrator',   '{"難度":"enum:入門/中階/進階","資源連結":"string","筆記":"string"}', '✒️', '#2563eb', 200),
-- ── 求職 (#7c3aed) ──
('job_interview', '面試技巧', '求職', '求職－面試技巧', '{"適用階段":"string","重點":"string"}', '🗣️', '#7c3aed', 210),
('job_resume',    '履歷撰寫', '求職', '求職－履歷撰寫', '{"適用階段":"string","重點":"string"}', '📄', '#7c3aed', 220),
-- ── 攝影 (#e11d48) ──
('photo_lighting',  '打光技巧', '攝影', '攝影－打光技巧', '{"器材":"string","難度":"enum:入門/中階/進階","範例連結":"string"}', '💡', '#e11d48', 230),
('photo_camera',    '相機挑選', '攝影', '攝影－相機挑選', '{"器材":"string","難度":"enum:入門/中階/進階","範例連結":"string"}', '📷', '#e11d48', 240),
('photo_technique', '攝影技巧', '攝影', '攝影－攝影技巧', '{"器材":"string","難度":"enum:入門/中階/進階","範例連結":"string"}', '📸', '#e11d48', 250),
('photo_lens',      '鏡頭挑選', '攝影', '攝影－鏡頭挑選', '{"器材":"string","難度":"enum:入門/中階/進階","範例連結":"string"}', '🔭', '#e11d48', 260),
-- ── 社群 (#db2777) ──
('social_ig_copy',    'IG 文案撰寫',  '社群', '社群－IG 文案撰寫',  '{"平台":"string","類型":"string","範例連結":"string"}', '✍️', '#db2777', 270),
('social_ig_growth',  'IG 經營技巧',  '社群', '社群－IG 經營技巧',  '{"平台":"string","類型":"string","範例連結":"string"}', '📈', '#db2777', 280),
('social_shortvideo', '短影音製作',   '社群', '社群－短影音製作',   '{"平台":"string","類型":"string","範例連結":"string"}', '🎬', '#db2777', 290),
('social_threads',    'Threads 經營', '社群', '社群－Threads 經營', '{"平台":"string","類型":"string","範例連結":"string"}', '🧵', '#db2777', 300),
('social_youtube',    'YouTube 經營', '社群', '社群－YouTube 經營', '{"平台":"string","類型":"string","範例連結":"string"}', '▶️', '#db2777', 310),
('social_hashtag',    'Hashtag 策略', '社群', '社群－Hashtag 策略', '{"平台":"string","類型":"string","範例連結":"string"}', '#️⃣', '#db2777', 320),
('social_visual',     '社群視覺設計', '社群', '社群－社群視覺設計', '{"平台":"string","類型":"string","範例連結":"string"}', '🖼️', '#db2777', 330),
-- ── 日本旅遊 (#dc2626) ──
('jp_tokyo',    '東京',   '日本旅遊', '日本旅遊－東京',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🗼', '#dc2626', 340),
('jp_osaka',    '大阪',   '日本旅遊', '日本旅遊－大阪',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏯', '#dc2626', 350),
('jp_kyoto',    '京都',   '日本旅遊', '日本旅遊－京都',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '⛩️', '#dc2626', 360),
('jp_fukuoka',  '福岡',   '日本旅遊', '日本旅遊－福岡',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🍜', '#dc2626', 370),
('jp_hokkaido', '北海道', '日本旅遊', '日本旅遊－北海道', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '❄️', '#dc2626', 380),
('jp_kyushu',   '九州',   '日本旅遊', '日本旅遊－九州',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '♨️', '#dc2626', 390),
('jp_nagoya',   '名古屋', '日本旅遊', '日本旅遊－名古屋', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏯', '#dc2626', 400),
('jp_okinawa',  '沖繩',   '日本旅遊', '日本旅遊－沖繩',   '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏝️', '#dc2626', 410),
-- ── 國內旅遊 (#0d9488) ──
('tw_taipei',         '台北市', '國內旅遊', '國內旅遊－台北市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 420),
('tw_new_taipei',     '新北市', '國內旅遊', '國內旅遊－新北市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 430),
('tw_taoyuan',        '桃園市', '國內旅遊', '國內旅遊－桃園市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 440),
('tw_taichung',       '台中市', '國內旅遊', '國內旅遊－台中市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 450),
('tw_tainan',         '台南市', '國內旅遊', '國內旅遊－台南市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 460),
('tw_kaohsiung',      '高雄市', '國內旅遊', '國內旅遊－高雄市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 470),
('tw_keelung',        '基隆市', '國內旅遊', '國內旅遊－基隆市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 480),
('tw_hsinchu_city',   '新竹市', '國內旅遊', '國內旅遊－新竹市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 490),
('tw_chiayi_city',    '嘉義市', '國內旅遊', '國內旅遊－嘉義市', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 500),
('tw_hsinchu_county', '新竹縣', '國內旅遊', '國內旅遊－新竹縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 510),
('tw_miaoli',         '苗栗縣', '國內旅遊', '國內旅遊－苗栗縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 520),
('tw_changhua',       '彰化縣', '國內旅遊', '國內旅遊－彰化縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 530),
('tw_nantou',         '南投縣', '國內旅遊', '國內旅遊－南投縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 540),
('tw_yunlin',         '雲林縣', '國內旅遊', '國內旅遊－雲林縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 550),
('tw_chiayi_county',  '嘉義縣', '國內旅遊', '國內旅遊－嘉義縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 560),
('tw_pingtung',       '屏東縣', '國內旅遊', '國內旅遊－屏東縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 570),
('tw_yilan',          '宜蘭縣', '國內旅遊', '國內旅遊－宜蘭縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 580),
('tw_hualien',        '花蓮縣', '國內旅遊', '國內旅遊－花蓮縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 590),
('tw_taitung',        '台東縣', '國內旅遊', '國內旅遊－台東縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '📍', '#0d9488', 600),
('tw_penghu',         '澎湖縣', '國內旅遊', '國內旅遊－澎湖縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏝️', '#0d9488', 610),
('tw_kinmen',         '金門縣', '國內旅遊', '國內旅遊－金門縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏝️', '#0d9488', 620),
('tw_lienchiang',     '連江縣', '國內旅遊', '國內旅遊－連江縣', '{"地點":"string","類型":"enum:景點/美食/住宿/交通/購物","門票":"string","備註":"string"}', '🏝️', '#0d9488', 630)
on conflict (key) do update set
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  attrs_schema = excluded.attrs_schema,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order;
