import { createApp } from 'vue'
import naive from "naive-ui";
import App from './App.vue'

import RunnersView from './components/Runners.vue'
import JobsView from './components/Jobs.vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const routes = [
  { path: '/', component: RunnersView },
  { path: '/runners', component: RunnersView },
  { path: '/jobs', component: JobsView },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

const app = createApp(App);
app.use(router);
app.use(naive);
app.mount('#app')
