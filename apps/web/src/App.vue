<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import ToastHost from '@/components/common/ToastHost.vue'

const route = useRoute()
</script>

<template>
  <!-- Blank layout (e.g. /login) renders without the app shell. -->
  <RouterView v-if="route.meta.blank" />
  <AppShell v-else>
    <RouterView />
  </AppShell>
  <!-- 全域 toast(操作成功/失敗回饋) -->
  <ToastHost />
</template>
