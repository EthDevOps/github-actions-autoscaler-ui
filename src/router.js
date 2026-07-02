import Dashboard from './views/Dashboard.vue'
import Runners from './views/Runners.vue'
import Jobs from './views/Jobs.vue'
import StuckJobs from './views/StuckJobs.vue'

export const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { title: 'Dashboard', icon: 'pi pi-chart-bar' } },
  { path: '/runners', name: 'runners', component: Runners, meta: { title: 'Runners', icon: 'pi pi-server' } },
  { path: '/jobs', name: 'jobs', component: Jobs, meta: { title: 'Jobs', icon: 'pi pi-list' } },
  { path: '/stuck', name: 'stuck', component: StuckJobs, meta: { title: 'Stuck Jobs', icon: 'pi pi-exclamation-triangle' } },
]
