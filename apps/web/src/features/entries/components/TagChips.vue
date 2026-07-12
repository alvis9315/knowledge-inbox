<script setup lang="ts">
import { useRouter } from 'vue-router'
import { SCOPE_ALL } from '@/features/entries/constants'

defineProps<{ tags: string[] }>()
const router = useRouter()

function go(t: string) {
  router.push({ name: 'browse', params: { type: SCOPE_ALL }, query: { tag: t } })
}
</script>

<template>
  <div v-if="tags.length" class="flex flex-wrap gap-1">
    <button
      v-for="t in tags"
      :key="t"
      class="rounded bg-canvas px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-accent"
      @click.stop="go(t)"
    >
      #{{ t }}
    </button>
  </div>
</template>
