<script setup lang="ts">
import { SlidersHorizontal } from 'lucide-vue-next'
import { activeLiveBg, bgControlsOpen } from './liveBgControls'
</script>

<template>
  <!-- 活背景控制器(僅活背景頁顯示):galaxy/threads 開參數面板、image 開上傳封面 -->
  <button
    v-if="activeLiveBg"
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-surface hover:text-ink"
    :class="bgControlsOpen ? 'bg-accent-soft text-accent' : ''"
    :title="activeLiveBg === 'image' ? '更換封面' : '調整背景參數'"
    @click="bgControlsOpen = !bgControlsOpen"
  >
    <SlidersHorizontal :size="16" />
  </button>
</template>
