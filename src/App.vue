<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="app-brand">
        <span class="brand-badge"><i class="pi pi-github" /></span>
        <span class="brand-text">
          Actions Orchestrator
          <small>Runner control plane</small>
        </span>
      </div>

      <nav class="app-nav">
        <router-link v-for="r in navRoutes" :key="r.path" :to="r.path">
          <i :class="r.meta.icon" />
          <span class="nav-label">{{ r.meta.title }}</span>
          <span
            v-if="r.name === 'stuck' && stuckCount > 0"
            class="nav-count alert"
          >{{ stuckCount }}</span>
        </router-link>
      </nav>

      <div class="app-sidebar-footer">
        <div><i class="pi pi-database" style="margin-right: 6px" />{{ apiHost }}</div>
        <div v-if="hasKey" style="margin-top: 4px">
          <i class="pi pi-lock" style="margin-right: 6px" />API key active
        </div>
      </div>
    </aside>

    <div class="app-main">
      <header class="app-topbar">
        <h1>{{ currentTitle }}</h1>
        <div class="spacer" />
        <Tag v-if="stuckCount > 0" severity="danger" rounded>
          <i class="pi pi-exclamation-triangle" style="margin-right: 4px" />
          {{ stuckCount }} stuck
        </Tag>
        <span v-if="session.loaded && session.authEnabled" class="identity"
          v-tooltip.bottom="session.roles.length ? 'Roles: ' + session.roles.join(', ') : 'No roles'">
          <i :class="session.canMutate ? 'pi pi-user' : 'pi pi-eye'" style="margin-right: 6px" />
          {{ session.user || 'anonymous' }}
          <Tag v-if="!session.canMutate" severity="secondary" value="read-only" style="margin-left: 6px" />
        </span>
        <span class="muted" v-tooltip.bottom="'Orchestrator health'">
          <i :class="healthy ? 'pi pi-circle-fill' : 'pi pi-circle'"
             :style="{ color: healthy ? 'var(--p-green-500)' : 'var(--p-red-500)', marginRight: '6px', fontSize: '0.6rem' }" />
          {{ healthy ? 'Connected' : 'Offline' }}
        </span>
      </header>

      <main class="app-content">
        <router-view />
      </main>
    </div>

    <Toast position="bottom-right" />
    <ConfirmDialog />
  </div>
</template>

<script>
import { routes } from './router'
import { api } from './api'
import { session, loadSession } from './session'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'

export default {
  name: 'App',
  components: { Tag, Toast, ConfirmDialog },
  data() {
    return {
      session,
      stuckCount: 0,
      healthy: true,
      pollTimer: null,
    }
  },
  computed: {
    navRoutes() {
      return routes.filter((r) => r.meta && r.meta.title)
    },
    currentTitle() {
      return this.$route.meta?.title ?? 'GitHub Actions Orchestrator'
    },
    apiHost() {
      try {
        return new URL(import.meta.env.VITE_API_URL).host
      } catch {
        return import.meta.env.VITE_API_URL || 'not configured'
      }
    },
    hasKey() {
      return !!import.meta.env.VITE_API_KEY
    },
  },
  mounted() {
    loadSession()
    this.pollStats()
    this.pollTimer = setInterval(this.pollStats, 15000)
  },
  beforeUnmount() {
    clearInterval(this.pollTimer)
  },
  methods: {
    async pollStats() {
      try {
        const stats = await api.getStats()
        this.stuckCount = stats?.jobs?.stuck ?? 0
        this.healthy = true
      } catch {
        this.healthy = false
      }
    },
  },
}
</script>
