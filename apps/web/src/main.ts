import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './assets/styles/main.css'

import { vTilt } from '@/directives/tilt'

createApp(App).use(createPinia()).use(router).directive('tilt', vTilt).mount('#app')
