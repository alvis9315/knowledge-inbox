<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import KnowledgeGalaxy from '@/components/backgrounds/KnowledgeGalaxy.vue'
</script>

<template>
  <div class="fixed inset-0 overflow-hidden">
    <KnowledgeGalaxy show-controls class="absolute inset-0" :hue-shift="210" :saturation="0" />
    <RouterLink
      to="/login"
      class="absolute left-4 top-4 z-40 inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/20"
    >
      <ArrowLeft :size="15" /> 回登入
    </RouterLink>
  </div>
</template>
