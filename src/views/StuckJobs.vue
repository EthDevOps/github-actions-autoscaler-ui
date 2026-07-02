<template>
  <div>
    <Message v-if="!loading && rows.length === 0" severity="success" :closable="false" class="all-clear">
      <i class="pi pi-check-circle" style="margin-right: 8px" />
      No stuck jobs. Everything queued in the last {{ threshold }} minutes is being handled.
    </Message>

    <div class="page-toolbar">
      <span class="muted">
        Jobs stuck in Queued/Throttled for more than {{ threshold }} minutes.
      </span>
      <div class="spacer" />
      <span class="muted">{{ rows.length }} stuck · {{ lastRefresh }}</span>
      <ToggleButton v-model="autoRefresh" onLabel="Auto" offLabel="Auto" onIcon="pi pi-sync" offIcon="pi pi-pause" />
      <Button icon="pi pi-refresh" :loading="loading" @click="load" v-tooltip.bottom="'Refresh'" />
      <Button v-if="rows.length" icon="pi pi-replay" label="Reschedule all" severity="warn" :disabled="!canMutate" @click="confirmRescheduleAll" />
    </div>

    <DataTable :value="rows" :loading="loading" dataKey="jobId" scrollable class="ops-table" sortField="queueTime" :sortOrder="1">
      <template #empty><div class="empty-state"><i class="pi pi-check-circle" /> No stuck jobs.</div></template>

      <Column header="Stuck for">
        <template #body="{ data }">
          <Tag severity="danger">
            <i class="pi pi-clock" style="margin-right: 4px" />{{ duration(data.queueTime) }}
          </Tag>
        </template>
      </Column>
      <Column field="state" header="State">
        <template #body="{ data }"><Tag :severity="jobMeta(data.state).severity" :value="jobMeta(data.state).label" /></template>
      </Column>
      <Column field="owner" header="Owner" sortable />
      <Column field="repository" header="Repository" sortable>
        <template #body="{ data }">
          <a class="link-plain" :href="`https://github.com/${data.repository}`" target="_blank">{{ data.repository }}</a>
        </template>
      </Column>
      <Column field="requestedSize" header="Size" sortable />
      <Column field="requestedProfile" header="Profile" />
      <Column field="queueTime" header="Queued at" sortable>
        <template #body="{ data }"><span v-tooltip="absolute(data.queueTime)">{{ rel(data.queueTime) }}</span></template>
      </Column>
      <Column header="GitHub">
        <template #body="{ data }">
          <Button v-if="data.jobUrl" size="small" text icon="pi pi-external-link" iconPos="right"
            :label="String(data.githubJobId)" :loading="!!ghLoading[data.jobId]"
            @click="openGithub(data)" v-tooltip="'Open job on GitHub'" />
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column header="" style="width: 250px" alignFrozen="right" frozen>
        <template #body="{ data }">
          <div class="row-actions">
            <Button size="small" outlined icon="pi pi-replay" label="Reschedule" :disabled="!canMutate" @click="confirmReschedule(data)" />
            <Button size="small" outlined severity="danger" icon="pi pi-ban" label="Cancel" :disabled="!canMutate" @click="confirmCancel(data)" />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script>
import axios from 'axios'
import { api, apiErrorMessage } from '../api'
import { session } from '../session'
import { jobStateMeta, relativeTime, absoluteTime, durationSince } from '../format'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

export default {
  name: 'StuckJobsView',
  components: { DataTable, Column, Button, ToggleButton, Tag, Message },
  setup() {
    return { toast: useToast(), confirm: useConfirm() }
  },
  data() {
    return {
      rows: [],
      threshold: 10,
      loading: false,
      autoRefresh: true,
      lastRefresh: '—',
      timer: null,
      ghLoading: {},
    }
  },
  computed: {
    canMutate() {
      return session.canMutate
    },
  },
  watch: {
    autoRefresh(on) {
      if (on) this.timer = setInterval(this.load, 8000)
      else clearInterval(this.timer)
    },
  },
  mounted() {
    this.load()
    if (this.autoRefresh) this.timer = setInterval(this.load, 8000)
  },
  beforeUnmount() {
    clearInterval(this.timer)
  },
  methods: {
    rel: relativeTime,
    absolute: absoluteTime,
    duration: durationSince,
    jobMeta: jobStateMeta,
    async openGithub(job) {
      // jobUrl is the GitHub REST API URL; fetch it and open its html_url.
      const win = window.open('', '_blank')
      if (win) win.opener = null
      this.ghLoading = { ...this.ghLoading, [job.jobId]: true }
      try {
        const resp = await axios.get(job.jobUrl)
        const htmlUrl = resp.data?.html_url
        if (htmlUrl) {
          if (win) win.location = htmlUrl
          else window.open(htmlUrl, '_blank', 'noopener')
        } else {
          if (win) win.close()
          this.toast.add({ severity: 'warn', summary: 'No GitHub link', detail: 'The job payload had no html_url.', life: 4000 })
        }
      } catch (e) {
        if (win) win.close()
        this.toastError('Could not open job on GitHub', e)
      } finally {
        this.ghLoading = { ...this.ghLoading, [job.jobId]: false }
      }
    },
    async load() {
      this.loading = true
      try {
        const data = await api.getStuckJobs()
        this.rows = data.items
        this.threshold = data.thresholdMinutes ?? 10
        this.lastRefresh = new Date().toLocaleTimeString()
      } catch (e) {
        this.toastError('Failed to load stuck jobs', e)
      } finally {
        this.loading = false
      }
    },
    confirmReschedule(job) {
      this.confirm.require({
        header: 'Reschedule job',
        message: `Queue a fresh runner for job ${job.githubJobId} in ${job.repository}?`,
        icon: 'pi pi-replay',
        acceptLabel: 'Reschedule',
        accept: () => this.reschedule(job),
      })
    },
    confirmRescheduleAll() {
      this.confirm.require({
        header: 'Reschedule all stuck jobs',
        message: `Queue a fresh runner for all ${this.rows.length} stuck jobs?`,
        icon: 'pi pi-replay',
        acceptClass: 'p-button-warn',
        acceptLabel: 'Reschedule all',
        accept: async () => {
          const jobs = [...this.rows]
          let ok = 0
          for (const job of jobs) {
            try {
              await api.rescheduleJob(job.jobId)
              ok++
            } catch (e) {
              console.error('reschedule failed', job.jobId, e)
            }
          }
          this.toast.add({ severity: 'success', summary: 'Rescheduled', detail: `Queued runners for ${ok}/${jobs.length} jobs.`, life: 5000 })
          this.load()
        },
      })
    },
    async reschedule(job) {
      try {
        const res = await api.rescheduleJob(job.jobId)
        this.toast.add({ severity: 'success', summary: 'Runner queued', detail: res.message, life: 4000 })
        this.load()
      } catch (e) {
        this.toastError('Reschedule failed', e)
      }
    },
    confirmCancel(job) {
      this.confirm.require({
        header: 'Cancel job',
        message: `Mark job ${job.githubJobId} in ${job.repository} as cancelled? This stops the orchestrator from creating runners for it.`,
        icon: 'pi pi-ban',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Cancel job',
        rejectLabel: 'Keep',
        accept: async () => {
          try {
            const res = await api.cancelJob(job.jobId)
            this.toast.add({ severity: 'success', summary: 'Job cancelled', detail: res.message, life: 4000 })
            this.load()
          } catch (e) {
            this.toastError('Cancel failed', e)
          }
        },
      })
    },
    toastError(summary, e) {
      this.toast.add({ severity: 'error', summary, detail: apiErrorMessage(e), life: 5000 })
    },
  },
}
</script>

<style scoped>
.all-clear { margin-bottom: 1rem; }
.row-actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-state { padding: 2.5rem; text-align: center; color: var(--p-text-muted-color); }
.empty-state i { display: block; font-size: 2rem; margin-bottom: 0.5rem; color: var(--p-green-500); }
</style>
