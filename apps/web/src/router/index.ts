import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/authStore'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { blank: true, public: true },
  },
  {
    path: '/galaxy',
    name: 'galaxy-playground',
    component: () => import('@/views/GalaxyPlayground.vue'),
    meta: { blank: true, public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/d/:domain',
    name: 'domain',
    component: () => import('@/views/DomainView.vue'),
    props: true,
  },
  {
    path: '/c/:type',
    name: 'category',
    component: () => import('@/views/CategoryView.vue'),
    props: true,
  },
  {
    path: '/browse/:type',
    name: 'browse',
    component: () => import('@/views/CategoryView.vue'),
    props: true,
  },
  {
    path: '/entries/:id',
    name: 'entry-detail',
    component: () => import('@/views/EntryDetailView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Auth guard: restore session, then gate everything behind login.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (!auth.isAuthed && !to.meta.public) return { name: 'login' }
  if (auth.isAuthed && to.name === 'login') return { name: 'home' }
  return true
})
