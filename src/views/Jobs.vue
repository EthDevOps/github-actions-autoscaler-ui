<template>
  <div>
    <div class="page-toolbar">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Search repo / owner / job id" @input="debouncedReload" />
      </IconField>
      <Select v-model="filters.state" :options="stateOptions" optionLabel="label" optionValue="value"
        placeholder="State" showClear class="filter-select" @change="reload" />
      <Select v-model="filters.owner" :options="options.owners" placeholder="Owner" showClear filter class="filter-select" @change="reload" />
      <Select v-model="filters.repository" :options="options.repositories" placeholder="Repository" showClear filter class="filter-select" @change="reload" />
      <Select v-model="filters.size" :options="options.sizes" placeholder="Size" showClear class="filter-select-sm" @change="reload" />
      <ToggleButton v-model="filters.stuckOnly" onLabel="Stuck only" offLabel="All jobs" onIcon="pi pi-exclamation-triangle" offIcon="pi pi-list" @change="reload" />
      <Button v-if="hasActiveFilters" text icon="pi pi-filter-slash" label="Clear" @click="clearFilters" />

      <div class="spacer" />
      <span class="muted">{{ totalRecords }} jobs · {{ lastRefresh }}</span>
      <ToggleButton v-model="autoRefresh" onLabel="Auto" offLabel="Auto" onIcon="pi pi-sync" offIcon="pi pi-pause" />
      <Button icon="pi pi-refresh" :loading="loading" @click="load" v-tooltip.bottom="'Refresh'" />
    </div>

    <DataTable
      :value="rows"
      lazy
      paginator
      :first="first"
      :rows="pageSize"
      :totalRecords="totalRecords"
      :loading="loading"
      :rowsPerPageOptions="[25, 50, 100, 200]"
      :sortField="sortField"
      :sortOrder="sortOrder"
      dataKey="jobId"
      removableSort
      scrollable
      paginatorTemplate="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
      @page="onPage"
      @sort="onSort"
      class="ops-table"
    >
      <template #empty><div class="empty-state"><i class="pi pi-list" /> No jobs match the current filters.</div></template>

      <Column field="state" header="State" sortable>
        <template #body="{ data }">
          <Tag :severity="jobMeta(data.state).severity" :value="jobMeta(data.state).label" />
        </template>
      </Column>
      <Column field="owner" header="Owner" sortable />
      <Column field="repository" header="Repository" sortable>
        <template #body="{ data }">
          <a class="link-plain" :href="`https://github.com/${data.repository}`" target="_blank">{{ data.repository }}</a>
        </template>
      </Column>
      <Column field="requestedSize" header="Size" />
      <Column field="requestedProfile" header="Profile" />
      <Column header="Runner">
        <template #body="{ data }">
          <a v-if="data.runner" class="runner-link" @click="openRunner(data.runner)"
             v-tooltip="'View runner details'">
            <span :class="data.runner.isOnline ? 'dot online' : 'dot offline'" />
            <span class="mono">{{ data.runner.hostname }}</span>
          </a>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column field="queueTime" header="Queued" sortable>
        <template #body="{ data }"><span v-tooltip="absolute(data.queueTime)">{{ rel(data.queueTime) }}</span></template>
      </Column>
      <Column field="inProgressTime" header="Started" sortable>
        <template #body="{ data }"><span v-tooltip="absolute(data.inProgressTime)">{{ rel(data.inProgressTime) }}</span></template>
      </Column>
      <Column field="completeTime" header="Completed" sortable>
        <template #body="{ data }"><span v-tooltip="absolute(data.completeTime)">{{ rel(data.completeTime) }}</span></template>
      </Column>
      <Column header="GitHub">
        <template #body="{ data }">
          <Button v-if="data.jobUrl" size="small" text class="gh-btn" icon="pi pi-external-link"
            iconPos="right" :label="String(data.githubJobId)" :loading="!!ghLoading[data.jobId]"
            @click="openGithub(data)" v-tooltip="'Open job on GitHub'" />
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column header="" style="width: 90px" alignFrozen="right" frozen>
        <template #body="{ data }">
          <div class="row-actions" v-if="canReschedule(data)">
            <Button size="small" text rounded icon="pi pi-replay" :disabled="!canMutate"
              @click="confirmReschedule(data)" v-tooltip="'Reschedule (new runner)'" />
            <Button size="small" text rounded severity="danger" icon="pi pi-ban" :disabled="!canMutate"
              @click="confirmCancel(data)" v-tooltip="'Cancel job'" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Drawer v-model:visible="detailVisible" position="right" class="detail-drawer"
      :style="{ width: 'min(max(33vw, 520px), 90vw)' }" :header="selectedRunner ? 'Runner detail' : ''">
      <RunnerDetail :runner="selectedRunner" :can-mutate="canMutate" @copy-ssh="copySsh" @delete="confirmDelete" />
    </Drawer>
  </div>
</template>

<script>
import axios from 'axios'
import { api, apiErrorMessage } from '../api'
import { session } from '../session'
import { jobStateMeta, relativeTime, absoluteTime, jobStateOptions } from '../format'
import RunnerDetail from '../components/RunnerDetail.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import Tag from 'primevue/tag'
import Drawer from 'primevue/drawer'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

export default {
  name: 'JobsView',
  components: { RunnerDetail, DataTable, Column, InputText, IconField, InputIcon, Select, Button, ToggleButton, Tag, Drawer },
  setup() {
    return { toast: useToast(), confirm: useConfirm() }
  },
  data() {
    return {
      rows: [],
      totalRecords: 0,
      loading: false,
      first: 0,
      pageSize: 50,
      sortField: null,
      sortOrder: -1,
      autoRefresh: false,
      lastRefresh: '—',
      timer: null,
      searchTimer: null,
      filters: { search: '', state: null, owner: null, repository: null, size: null, stuckOnly: false },
      options: { owners: [], sizes: [], repositories: [] },
      stateOptions: jobStateOptions,
      ghLoading: {},
      detailVisible: false,
      selectedRunner: null,
    }
  },
  computed: {
    canMutate() {
      return session.canMutate
    },
    hasActiveFilters() {
      const f = this.filters
      return !!(f.search || f.state != null || f.owner || f.repository || f.size || f.stuckOnly)
    },
  },
  watch: {
    autoRefresh(on) {
      if (on) this.timer = setInterval(this.load, 4000)
      else clearInterval(this.timer)
    },
  },
  async mounted() {
    await this.loadOptions()
    this.load()
  },
  beforeUnmount() {
    clearInterval(this.timer)
    clearTimeout(this.searchTimer)
  },
  methods: {
    rel: relativeTime,
    absolute: absoluteTime,
    jobMeta: jobStateMeta,
    async openGithub(job) {
      // The stored jobUrl is the GitHub REST API URL; its JSON payload carries the
      // browser html_url. Fetch it, then redirect a pre-opened tab to that URL.
      // The blank tab is opened synchronously so it survives popup blockers.
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
    async openRunner(summary) {
      try {
        this.selectedRunner = await api.getRunner(summary.runnerId)
        this.detailVisible = true
      } catch (e) {
        this.toastError('Could not load runner', e)
      }
    },
    async copySsh(ip) {
      if (!ip) return
      const cmd = `ssh devops@${ip}`
      try {
        await navigator.clipboard.writeText(cmd)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = cmd
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      this.toast.add({ severity: 'info', summary: 'Copied', detail: cmd, life: 2500 })
    },
    confirmDelete(runner) {
      this.confirm.require({
        header: 'Delete runner',
        message: `Queue runner "${runner.hostname}" (${runner.owner}) for deletion? Its cloud VM will be destroyed.`,
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Delete',
        accept: async () => {
          try {
            const res = await api.deleteRunner(runner.runnerId)
            this.toast.add({ severity: 'success', summary: 'Deletion queued', detail: res.message, life: 4000 })
            this.detailVisible = false
            this.load()
          } catch (e) {
            this.toastError('Delete failed', e)
          }
        },
      })
    },
    canReschedule(job) {
      return job.state === 1 || job.state === 6 // Queued or Throttled
    },
    buildParams() {
      const f = this.filters
      const params = { limit: this.pageSize, offset: this.first }
      if (f.search) params.search = f.search
      if (f.state != null) params.state = f.state
      if (f.owner) params.owner = f.owner
      if (f.repository) params.repository = f.repository
      if (f.size) params.size = f.size
      if (f.stuckOnly) params.stuckOnly = true
      if (this.sortField) {
        params.sortField = this.sortField
        params.sortOrder = this.sortOrder
      }
      return params
    },
    async load() {
      this.loading = true
      try {
        const data = await api.getJobs(this.buildParams())
        this.rows = data.items
        this.totalRecords = data.total
        this.lastRefresh = new Date().toLocaleTimeString()
      } catch (e) {
        this.toastError('Failed to load jobs', e)
      } finally {
        this.loading = false
      }
    },
    async loadOptions() {
      try {
        const o = await api.getFilterOptions()
        this.options.owners = o.owners || []
        this.options.sizes = o.sizes || []
        this.options.repositories = o.repositories || []
      } catch (e) {
        console.error('Failed to load filter options', e)
      }
    },
    reload() {
      this.first = 0
      this.load()
    },
    debouncedReload() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(this.reload, 350)
    },
    clearFilters() {
      this.filters = { search: '', state: null, owner: null, repository: null, size: null, stuckOnly: false }
      this.reload()
    },
    onPage(e) {
      this.first = e.first
      this.pageSize = e.rows
      this.load()
    },
    onSort(e) {
      this.sortField = e.sortField
      this.sortOrder = e.sortOrder
      this.first = 0
      this.load()
    },
    confirmReschedule(job) {
      this.confirm.require({
        header: 'Reschedule job',
        message: `Queue a fresh runner for job ${job.githubJobId} in ${job.repository}?`,
        icon: 'pi pi-replay',
        acceptLabel: 'Reschedule',
        accept: async () => {
          try {
            const res = await api.rescheduleJob(job.jobId)
            this.toast.add({ severity: 'success', summary: 'Runner queued', detail: res.message, life: 4000 })
            this.load()
          } catch (e) {
            this.toastError('Reschedule failed', e)
          }
        },
      })
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
.filter-select { width: 160px; }
.filter-select-sm { width: 130px; }
.empty-state { padding: 2.5rem; text-align: center; color: var(--p-text-muted-color); }
.empty-state i { display: block; font-size: 2rem; margin-bottom: 0.5rem; }
.gh-btn { padding: 2px 6px; }
.row-actions { display: flex; gap: 2px; justify-content: flex-end; }
.runner-link { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--p-primary-300); }
.runner-link:hover { text-decoration: underline; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dot.online { background: var(--p-green-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-green-500) 25%, transparent); }
.dot.offline { background: var(--p-surface-600); }
</style>
