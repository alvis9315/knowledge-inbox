<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'

/**
 * Emoji 選擇器(精選分組網格,零依賴)。v-model 是單一 emoji 字串。
 * 底部保留自由輸入,想貼任何系統 emoji 都行。
 */
const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), {
  placeholder: '選 icon',
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
// 面板 Teleport 到 body,不被彈窗/捲動容器裁切。
const { open, style } = useAnchoredPanel(root, { panelWidth: 320, panelMaxHeight: 400 })
onClickOutside(root, () => (open.value = false), { ignore: [panel] })

function pick(e: string) {
  emit('update:modelValue', e)
  open.value = false
}

type Item = [emoji: string, keywords: string]
const GROUPS: Array<{ label: string; items: Item[] }> = [
  { label: '美食', items: [
    ['☕','咖啡 coffee 熱飲'],['🍵','茶 抹茶 tea'],['🧋','手搖 珍奶 奶茶 boba'],['🥤','飲料 汽水 drink'],['🍶','清酒 日本酒 sake'],['🍺','啤酒 beer'],['🍷','紅酒 葡萄酒 餐酒 wine'],['🍸','調酒 雞尾酒 cocktail'],['🍹','熱帶 調酒 果汁'],
    ['🍽️','餐廳 餐具 dining'],['🥢','筷子 中式 日式'],['🍜','拉麵 麵 湯麵 ramen'],['🍣','壽司 日料 sushi'],['🍱','便當 定食 bento'],['🍙','飯糰 御飯糰'],['🍛','咖哩 curry'],['🍤','炸蝦 天婦羅'],['🥟','水餃 餃子 中式'],
    ['🍝','義大利麵 義式 pasta'],['🍕','披薩 pizza'],['🍔','漢堡 速食 burger'],['🌮','塔可 墨西哥 taco'],['🥗','沙拉 蔬食 salad'],['🥩','牛排 肉 排餐 steak'],['🍳','早午餐 蛋 brunch'],['🥞','鬆餅 pancake'],['🥐','可頌 麵包 croissant'],
    ['🍞','吐司 麵包 bread'],['🧀','起司 cheese'],['🍰','蛋糕 甜點 cake'],['🧁','杯子蛋糕 甜點'],['🍮','布丁 甜點 pudding'],['🦪','生蠔 海鮮 oyster'],['🍦','霜淇淋 冰 icecream'],['🍧','剉冰 冰品 剩冰'],['🍫','巧克力 chocolate'],
    ['🍿','爆米花 電影 popcorn'],['🍎','蘋果 水果 apple'],['🍓','草莓 水果'],['🍉','西瓜 水果'],['🥭','芒果 水果'],
  ]},
  { label: '旅遊 / 地點', items: [
    ['🗺️','地圖 旅遊 map'],['🧭','指南針 方向 探索'],['📍','地點 定位 pin'],['🗾','日本 japan'],['🏝️','離島 海島 island'],['🏖️','海灘 沙灘 beach'],['⛰️','山 登山 mountain'],['🗻','富士山 山'],['🏕️','露營 camping'],
    ['⛩️','神社 鳥居 日本'],['🏯','城 日本城 大阪'],['🏰','城堡 歐洲 castle'],['🗼','鐵塔 東京 tower'],['🗽','自由女神 紐約 美國'],['🌋','火山 volcano'],['♨️','溫泉 湯 onsen'],['🚗','汽車 自駕 car'],['🚌','公車 巴士 bus'],
    ['🚄','高鐵 新幹線 train'],['✈️','飛機 出國 flight'],['🛫','起飛 機場 出發'],['🚢','郵輪 船 cruise'],['🎡','摩天輪 樂園'],['🎢','雲霄飛車 樂園'],['🎠','旋轉木馬 樂園'],['🏨','飯店 住宿 hotel'],['🛏️','住宿 床 民宿'],['🧳','行李 旅行 luggage'],['🌸','櫻花 賞花 春'],['🍁','楓葉 賞楓 秋'],
  ]},
  { label: '學習 / 工作', items: [
    ['💻','筆電 程式 coding'],['🖥️','電腦 桌機'],['⌨️','鍵盤 打字'],['📱','手機 mobile'],['🤖','AI 機器人 robot'],['🧠','思考 知識 腦'],['📚','書 閱讀 books'],['📖','讀書 筆記'],['📓','筆記本 note'],['📝','筆記 寫作 memo'],
    ['✏️','鉛筆 寫字'],['🖊️','筆 簽名'],['📐','設計 製圖 uiux'],['📏','尺 測量'],['🗄️','資料庫 檔案 database'],['📊','圖表 數據 chart'],['📈','成長 趨勢 分析'],['💼','工作 求職 job'],['🗂️','資料夾 分類'],['📄','文件 履歷 resume'],
    ['🎓','畢業 學位 課程'],['🔬','實驗 研究'],['🔭','望遠鏡 觀測 鏡頭'],['⚙️','設定 後端 工程'],['🛠️','工具 維修'],['🧩','拼圖 模組'],['💡','點子 靈感 打光'],['🗣️','面試 口說 演講'],
  ]},
  { label: '攝影 / 媒體', items: [
    ['📷','相機 攝影 camera'],['📸','拍照 自拍'],['🎥','攝影機 錄影'],['🎬','影片 剪輯 短影音'],['🎞️','底片 膠卷'],['🖼️','照片 畫框 圖片'],['🎨','設計 調色 藝術'],['🖌️','筆刷 photoshop'],['✒️','鋼筆 illustrator'],['🎭','戲劇 表演'],
    ['🎵','音樂 music'],['🎶','歌 旋律'],['🎧','耳機 podcast'],['🎤','麥克風 唱歌 錄音'],['📻','廣播 電台'],['🎮','遊戲 電玩 game'],
  ]},
  { label: '社群 / 生活', items: [
    ['📣','宣傳 行銷 廣播'],['💬','留言 訊息 聊天'],['🗨️','對話 評論'],['❤️','愛心 喜歡 like'],['⭐','星星 收藏 評分'],['✨','亮點 精選'],['🔥','熱門 爆紅 流行'],['👍','讚 好評'],['✍️','文案 寫作'],['🧵','Threads 討論串'],
    ['▶️','YouTube 影片 播放'],['#️⃣','hashtag 標籤'],['🏠','家 居家 房'],['🛋️','客廳 家具 居家'],['🪴','植物 綠植'],['🛒','購物 採買 shopping'],['🎁','禮物 送禮'],['🐱','貓 寵物 cat'],['🐶','狗 寵物 dog'],['🐰','兔子 寵物'],
    ['🦊','狐狸'],['🐻','熊'],['🐼','貓熊 熊貓'],['💪','健身 運動 肌肉'],['🧘','瑜珈 冥想 放鬆'],['⚽','足球 運動'],['🏀','籃球 運動'],
  ]},
  { label: '符號 / 其他', items: [
    ['🏷️','標籤 tag'],['📌','釘選 重點'],['📎','附件 迴紋針'],['🔖','書籤 收藏'],['🔗','連結 link'],['🔒','鎖 隱私 安全'],['🔑','鑰匙 密碼'],['⏰','鬧鐘 提醒'],['🕓','時間 待辦'],['📅','日曆 行程'],
    ['✅','完成 打勾'],['❌','錯誤 取消'],['⚠️','警告 注意'],['❓','問題 疑問'],['❗','重要 驚嘆'],['➕','新增 加'],['🟢','綠 通過'],['🔵','藍'],['🟡','黃'],['🔴','紅 緊急'],['🟣','紫'],['⚪','白'],['🍀','幸運 四葉草'],['🌙','夜 月亮'],['☀️','日 太陽 晴'],['🌈','彩虹 多彩'],
  ]},
]

const search = ref('')
const EMOJI_RE = /\p{Extended_Pictographic}/u
const searching = computed(() => search.value.trim() !== '' && !EMOJI_RE.test(search.value))
const flatResults = computed(() => {
  const t = search.value.trim().toLowerCase()
  const out: Item[] = []
  for (const g of GROUPS) for (const it of g.items) {
    if (it[1].toLowerCase().includes(t) || it[0] === t) out.push(it)
    if (out.length >= 45) return out
  }
  return out
})
function onSearchInput(v: string) {
  // 貼上 emoji = 直接選用;打文字 = 關鍵字過濾
  if (EMOJI_RE.test(v)) {
    emit('update:modelValue', v.trim())
    search.value = ''
  } else {
    search.value = v
  }
}

</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      @click="open = !open"
    >
      <span v-if="modelValue" class="text-lg leading-none">{{ modelValue }}</span>
      <span v-else class="text-muted">{{ placeholder }}</span>
      <ChevronDown :size="14" class="ml-auto shrink-0 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      :style="style"
      class="rounded-xl border border-line bg-surface shadow-xl"
    >
      <!-- 自由輸入置頂:清單沒有的,直接貼系統 emoji -->
      <div class="shrink-0 border-b border-line p-2">
        <input
          :value="search"
          type="text"
          placeholder="搜尋:咖啡、旅遊、面試…(或直接貼 emoji)"
          class="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          @input="onSearchInput(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
        <!-- 關鍵字搜尋:跨分組扁平結果 -->
        <template v-if="searching">
          <p v-if="flatResults.length === 0" class="px-1 py-3 text-center text-xs text-muted">找不到,換個關鍵字或直接貼 emoji</p>
          <div class="grid grid-cols-9 gap-0.5">
            <button
              v-for="it in flatResults"
              :key="it[0]"
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:bg-canvas"
              :class="modelValue === it[0] ? 'bg-accent-soft ring-1 ring-accent' : ''"
              :title="it[1]"
              @click="pick(it[0])"
            >{{ it[0] }}</button>
          </div>
        </template>
        <div v-for="g in GROUPS" v-else :key="g.label" class="mb-1.5">
          <p class="mb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ g.label }}</p>
          <div class="grid grid-cols-9 gap-0.5">
            <button
              v-for="it in g.items"
              :key="it[0]"
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:bg-canvas"
              :class="modelValue === it[0] ? 'bg-accent-soft ring-1 ring-accent' : ''"
              :title="it[1]"
              @click="pick(it[0])"
            >
              {{ it[0] }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>
