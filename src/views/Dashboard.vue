<template>
  <div>
    <div class="page-toolbar">
      <span class="muted">
        <i class="pi pi-clock" style="margin-right: 6px" />
        Last updated {{ lastRefresh }}
      </span>
      <div class="spacer" />
      <ToggleButton
        v-model="autoRefresh"
        onLabel="Auto-refresh on"
        offLabel="Auto-refresh off"
        onIcon="pi pi-sync"
        offIcon="pi pi-pause"
      />
      <Button icon="pi pi-refresh" label="Refresh" :loading="loading" @click="load" />
    </div>

    <div class="stat-grid">
      <StatCard label="Active runners" :value="stats.runners.active" icon="pi pi-server" tone="primary"
        :sub="`${stats.runners.online} online · ${stats.runners.total} total`" clickable @click="go('/runners')" />
      <StatCard label="Processing" :value="runnerState('Processing')" icon="pi pi-play-circle" tone="success"
        sub="runners with a job" />
      <StatCard label="Provisioning" :value="stats.queues.provisioning" icon="pi pi-spinner" tone="info"
        sub="created, not yet ready" />
      <StatCard label="Create queue" :value="stats.queues.create" icon="pi pi-plus-circle" tone="info" />
      <StatCard label="Delete queue" :value="stats.queues.delete" icon="pi pi-trash" tone="warn" />
      <StatCard label="Total jobs" :value="stats.jobs.total" icon="pi pi-list" clickable @click="go('/jobs')" />
      <StatCard label="Throttled jobs" :value="stats.jobs.throttled" icon="pi pi-clock"
        :tone="stats.jobs.throttled > 0 ? 'warn' : ''" />
      <StatCard label="Stuck jobs" :value="stats.jobs.stuck" icon="pi pi-exclamation-triangle"
        :tone="stats.jobs.stuck > 0 ? 'danger' : 'success'" sub="queued > 10 min" clickable @click="go('/stuck')" />
    </div>

    <div class="breakdown-grid">
      <Panel header="Runners by state">
        <div v-if="runnerStateRows.length" class="chip-list">
          <div v-for="row in runnerStateRows" :key="row.key" class="chip-row">
            <Tag :severity="row.severity" :value="row.label" />
            <div class="bar-track"><div class="bar-fill" :style="{ width: row.pct + '%', background: barColor(row.severity) }" /></div>
            <span class="chip-count">{{ row.count }}</span>
          </div>
        </div>
        <p v-else class="muted">No runners.</p>
      </Panel>

      <Panel header="Jobs by state">
        <div v-if="jobStateRows.length" class="chip-list">
          <div v-for="row in jobStateRows" :key="row.key" class="chip-row">
            <Tag :severity="row.severity" :value="row.label" />
            <div class="bar-track"><div class="bar-fill" :style="{ width: row.pct + '%', background: barColor(row.severity) }" /></div>
            <span class="chip-count">{{ row.count }}</span>
          </div>
        </div>
        <p v-else class="muted">No jobs.</p>
      </Panel>

      <Panel header="Runners by cloud">
        <div v-if="cloudRows.length" class="chip-list">
          <div v-for="row in cloudRows" :key="row.key" class="chip-row">
            <Tag severity="secondary" :value="row.key" />
            <div class="bar-track"><div class="bar-fill" :style="{ width: row.pct + '%', background: 'var(--p-primary-500)' }" /></div>
            <span class="chip-count">{{ row.count }}</span>
          </div>
        </div>
        <p v-else class="muted">No runners.</p>
      </Panel>
    </div>
  </div>
</template>

<script>
import { api } from '../api'
import { runnerStatusMeta, jobStateMeta } from '../format'
import StatCard from '../components/StatCard.vue'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import Panel from 'primevue/panel'
import Tag from 'primevue/tag'

const EMPTY = {
  jobs: { total: 0, byState: {}, stuck: 0, throttled: 0 },
  runners: { total: 0, online: 0, active: 0, byState: {}, byCloud: {} },
  queues: { create: 0, delete: 0, provisioning: 0 },
}

const RUNNER_STATE_KEYS = ['Processing', 'Provisioned', 'Created', 'CreationQueued', 'Failure', 'DeletionQueued', 'Cleanup', 'Deleted', 'Cancelled', 'VanishedOnCloud', 'Unknown']
const JOB_STATE_KEYS = { Unknown: 0, Queued: 1, InProgress: 2, Completed: 3, Vanished: 4, Cancelled: 5, Throttled: 6 }
const RUNNER_STATE_CODES = { Unknown: 0, CreationQueued: 1, Created: 2, Provisioned: 3, Processing: 4, DeletionQueued: 5, Deleted: 6, Failure: 7, VanishedOnCloud: 8, Cleanup: 9, Cancelled: 10 }

export default {
  name: 'DashboardView',
  components: { StatCard, Button, ToggleButton, Panel, Tag },
  data() {
    return {
      stats: structuredClone(EMPTY),
      loading: false,
      autoRefresh: true,
      lastRefresh: '—',
      timer: null,
    }
  },
  computed: {
    runnerStateRows() {
      const byState = this.stats.runners.byState || {}
      const max = Math.max(1, ...Object.values(byState))
      return RUNNER_STATE_KEYS
        .filter((k) => byState[k])
        .map((k) => {
          const meta = runnerStatusMeta(RUNNER_STATE_CODES[k])
          return { key: k, label: meta.label, severity: meta.severity, count: byState[k], pct: (byState[k] / max) * 100 }
        })
    },
    jobStateRows() {
      const byState = this.stats.jobs.byState || {}
      const max = Math.max(1, ...Object.values(byState))
      return Object.keys(JOB_STATE_KEYS)
        .filter((k) => byState[k])
        .map((k) => {
          const meta = jobStateMeta(JOB_STATE_KEYS[k])
          return { key: k, label: meta.label, severity: meta.severity, count: byState[k], pct: (byState[k] / max) * 100 }
        })
    },
    cloudRows() {
      const byCloud = this.stats.runners.byCloud || {}
      const max = Math.max(1, ...Object.values(byCloud))
      return Object.entries(byCloud)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, count, pct: (count / max) * 100 }))
    },
  },
  watch: {
    autoRefresh(on) {
      if (on) this.timer = setInterval(this.load, 5000)
      else clearInterval(this.timer)
    },
  },
  mounted() {
    this.load()
    if (this.autoRefresh) this.timer = setInterval(this.load, 5000)
  },
  beforeUnmount() {
    clearInterval(this.timer)
  },
  methods: {
    async load() {
      this.loading = true
      try {
        this.stats = await api.getStats()
        this.lastRefresh = new Date().toLocaleTimeString()
      } catch (e) {
        // Surface via console; App topbar reflects connectivity.
        console.error('Failed to load stats', e)
      } finally {
        this.loading = false
      }
    },
    runnerState(key) {
      return this.stats.runners.byState?.[key] ?? 0
    },
    go(path) {
      this.$router.push(path)
    },
    barColor(severity) {
      const map = {
        success: 'var(--p-green-500)',
        info: 'var(--p-sky-500)',
        warn: 'var(--p-amber-500)',
        danger: 'var(--p-red-500)',
        secondary: 'var(--p-surface-500)',
      }
      return map[severity] || 'var(--p-primary-500)'
    },
  },
}
</script>

<style scoped>
.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}
.chip-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.chip-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.chip-row :deep(.p-tag) {
  min-width: 118px;
  justify-content: flex-start;
}
.bar-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--p-surface-800);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s;
}
.chip-count {
  min-width: 32px;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
