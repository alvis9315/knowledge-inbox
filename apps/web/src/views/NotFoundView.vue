<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="flex flex-col items-center gap-4 py-24 text-center">
    <p class="text-5xl font-bold text-muted/50">404</p>
    <p class="text-muted">找不到這個頁面</p>
    <RouterLink to="/" class="text-sm text-accent hover:underline">← 回總覽</RouterLink>
  </section>
</template>
