<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'

const route = useRoute()
</script>

<template>
  <!-- Blank layout (e.g. /login) renders without the app shell. -->
  <RouterView v-if="route.meta.blank" />
  <AppShell v-else>
    <RouterView />
  </AppShell>
</template>
