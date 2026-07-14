<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { activeLiveBg } from './liveBgControls'
import { MAX_SLOTS, addSlot, selectSlot, slotState, tabsRevision } from './bgPresets'

// 控制面板上緣的「方案」頁籤:每種活背景最多 10 套參數存檔。
// 切換頁籤立即套用該方案;調整後按面板的「完成」存進當前方案。
const state = computed(() => {
  void tabsRevision.value // 依賴頁籤計數,切換/新增後重算
  return activeLiveBg.value ? slotState(activeLiveBg.value) : { active: 0, count: 1 }
})

const pick = (i: number) => {
  if (activeLiveBg.value) selectSlot(activeLiveBg.value, i)
}
const add = () => {
  if (activeLiveBg.value) addSlot(activeLiveBg.value)
}
</script>

<template>
  <!-- 方案系統只在 App 場景有效(activeLiveBg 由 AppShell 維護);
       登入頁/playground 的面板不顯示頁籤,避免出現按了沒反應的死按鈕。 -->
  <div v-if="activeLiveBg" class="mb-3 flex items-center gap-1.5">
    <span class="mr-1 text-xs font-medium text-white/60">方案</span>
    <button
      v-for="i in state.count"
      :key="i"
      type="button"
      class="h-7 min-w-7 rounded-lg px-2 text-xs font-semibold transition"
      :class="state.active === i - 1 ? 'bg-white text-slate-900' : 'bg-white/10 text-white/75 hover:bg-white/20'"
      :title="`方案 ${i}(切換立即套用)`"
      @click="pick(i - 1)"
    >
      {{ i }}
    </button>
    <button
      v-if="state.count < MAX_SLOTS"
      type="button"
      class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-white/30 text-white/70 transition hover:bg-white/10"
      title="新增方案(以目前參數為起點)"
      @click="add"
    >
      <Plus :size="13" />
    </button>
    <span class="ml-1 text-[11px] text-white/40">切換即套用,「完成」存入當前方案</span>
  </div>
</template>
