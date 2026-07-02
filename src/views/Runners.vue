<template>
  <div>
    <div class="page-toolbar">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Search host / IP / owner" @input="debouncedReload" />
      </IconField>
      <Select v-model="filters.status" :options="statusOptions" optionLabel="label" optionValue="value"
        placeholder="Status" showClear class="filter-select" @change="reload" />
      <Select v-model="filters.cloud" :options="options.clouds" placeholder="Cloud" showClear class="filter-select-sm" @change="reload" />
      <Select v-model="filters.owner" :options="options.owners" placeholder="Owner" showClear filter class="filter-select" @change="reload" />
      <Select v-model="filters.size" :options="options.sizes" placeholder="Size" showClear class="filter-select-sm" @change="reload" />
      <Select v-model="filters.profile" :options="options.profiles" placeholder="Profile" showClear class="filter-select-sm" @change="reload" />
      <ToggleButton v-model="filters.online" onLabel="Online only" offLabel="All states" onIcon="pi pi-circle-fill" offIcon="pi pi-circle" @change="reload" />
      <Button v-if="hasActiveFilters" text icon="pi pi-filter-slash" label="Clear" @click="clearFilters" />

      <div class="spacer" />

      <span class="muted">{{ totalRecords }} runners · {{ lastRefresh }}</span>
      <ToggleButton v-model="autoRefresh" onLabel="Auto" offLabel="Auto" onIcon="pi pi-sync" offIcon="pi pi-pause" />
      <Button icon="pi pi-refresh" :loading="loading" @click="load" v-tooltip.bottom="'Refresh'" />
      <Button icon="pi pi-plus" label="Create runner" severity="primary" :disabled="!canMutate" @click="openCreate" />
      <Button icon="pi pi-eraser" label="Clean up" severity="warn" outlined :disabled="!canMutate" @click="confirmCleanup"
        v-tooltip.bottom="'Remove runners abandoned in the creation queue'" />
      <Button icon="pi pi-bolt" label="Kill idle" severity="danger" outlined :disabled="!canMutate" @click="confirmKill" v-tooltip.bottom="'Kill all non-processing runners'" />
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
      dataKey="runnerId"
      removableSort
      scrollable
      paginatorTemplate="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
      currentPageReportTemplate="{first}–{last} of {totalRecords}"
      @page="onPage"
      @sort="onSort"
      @row-click="onRowClick"
      class="ops-table"
    >
      <template #empty><div class="empty-state"><i class="pi pi-server" /> No runners match the current filters.</div></template>

      <Column field="isonline" header="" sortable style="width: 40px">
        <template #body="{ data }">
          <span :class="data.isOnline ? 'dot online' : 'dot offline'" v-tooltip="data.isOnline ? 'Online' : 'Offline'" />
        </template>
      </Column>
      <Column field="hostname" header="Hostname" sortable>
        <template #body="{ data }">
          <span class="mono dt-cell-strong">{{ data.hostname }}</span>
          <a v-if="data.hostname && data.hostname !== 'Unknown'" class="grafana-link"
             :href="grafanaUrl(data.hostname)" target="_blank" @click.stop v-tooltip="'Grafana'">
            <i class="pi pi-chart-line" />
          </a>
        </template>
      </Column>
      <Column field="lastState" header="State">
        <template #body="{ data }">
          <Tag :severity="statusMeta(data.lastState).severity" :value="statusMeta(data.lastState).label" />
        </template>
      </Column>
      <Column field="owner" header="Owner" sortable>
        <template #body="{ data }">
          <a class="link-plain" :href="`https://github.com/${data.owner}`" target="_blank" @click.stop>{{ data.owner }}</a>
        </template>
      </Column>
      <Column field="size" header="Size" sortable />
      <Column field="profile" header="Profile" sortable />
      <Column field="cloud" header="Cloud" sortable />
      <Column field="iPv4" header="IP">
        <template #body="{ data }"><span class="mono">{{ data.iPv4 || '—' }}</span></template>
      </Column>
      <Column header="Job">
        <template #body="{ data }">
          <Tag v-if="data.job" :severity="jobMeta(data.job.state).severity" :value="jobMeta(data.job.state).label" />
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column header="Age">
        <template #body="{ data }">
          <span v-tooltip="absolute(createdTime(data))">{{ rel(createdTime(data)) }}</span>
        </template>
      </Column>
      <Column header="" style="width: 130px" alignFrozen="right" frozen>
        <template #body="{ data }">
          <div class="row-actions" @click.stop>
            <Button size="small" text rounded icon="pi pi-copy" :disabled="!data.iPv4" @click="copySsh(data.iPv4)" v-tooltip="'Copy SSH'" />
            <Button size="small" text rounded icon="pi pi-eye" @click="openDetail(data)" v-tooltip="'Details'" />
            <Button size="small" text rounded severity="danger" icon="pi pi-trash"
              :disabled="isTerminal(data) || !canMutate" @click="confirmDelete(data)" v-tooltip="'Delete runner'" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Detail drawer -->
    <Drawer v-model:visible="detailVisible" position="right" class="detail-drawer"
      :style="{ width: 'min(max(33vw, 520px), 90vw)' }" :header="selected ? 'Runner detail' : ''">
      <RunnerDetail :runner="selected" :can-mutate="canMutate" @copy-ssh="copySsh" @delete="confirmDelete" />
    </Drawer>

    <!-- Create runner dialog -->
    <Dialog v-model:visible="createVisible" modal header="Create runner" :style="{ width: '440px' }">
      <div class="form-grid">
        <label>Target owner</label>
        <Select v-model="createForm.owner" :options="targetOptions" optionLabel="name" optionValue="name" placeholder="Select target" filter />
        <label>Size</label>
        <Select v-model="createForm.size" :options="options.sizes" placeholder="Select size" />
        <label>Profile</label>
        <Select v-model="createForm.profile" :options="profileChoices" editable placeholder="default" />
      </div>
      <template #footer>
        <Button text label="Cancel" @click="createVisible = false" />
        <Button label="Create" icon="pi pi-plus" :loading="creating"
          :disabled="!createForm.owner || !createForm.size || !canMutate" @click="submitCreate" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { api, apiErrorMessage } from '../api'
import { session } from '../session'
import { runnerStatusMeta, jobStateMeta, relativeTime, absoluteTime, runnerStatusOptions, sortedLifecycle } from '../format'
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
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

export default {
  name: 'RunnersView',
  components: { RunnerDetail, DataTable, Column, InputText, IconField, InputIcon, Select, Button, ToggleButton, Tag, Drawer, Dialog },
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
      filters: { search: '', status: null, cloud: null, owner: null, size: null, profile: null, online: false },
      options: { owners: [], sizes: [], profiles: [], clouds: [], targets: [] },
      statusOptions: runnerStatusOptions,
      detailVisible: false,
      selected: null,
      createVisible: false,
      creating: false,
      createForm: { owner: null, size: null, profile: 'default' },
    }
  },
  computed: {
    canMutate() {
      return session.canMutate
    },
    hasActiveFilters() {
      const f = this.filters
      return !!(f.search || f.status != null || f.cloud || f.owner || f.size || f.profile || f.online)
    },
    targetOptions() {
      return this.options.targets
    },
    profileChoices() {
      return this.options.profiles.length ? this.options.profiles : ['default']
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
    statusMeta: runnerStatusMeta,
    jobMeta: jobStateMeta,
    createdTime(runner) {
      return sortedLifecycle(runner)[0]?.eventTimeUtc
    },
    isTerminal(runner) {
      return [5, 6].includes(runner.lastState)
    },
    grafanaUrl(host) {
      return `https://grafana.ethquokkaops.io/d/rYdddlPWk/node-exporter-full?orgId=1&var-DS_PROMETHEUS=default&var-job=integrations%2Fnode_exporter&var-node=${host}:9090`
    },
    buildParams() {
      const f = this.filters
      const params = { limit: this.pageSize, offset: this.first }
      if (f.search) params.search = f.search
      if (f.status != null) params.status = f.status
      if (f.cloud) params.cloud = f.cloud
      if (f.owner) params.owner = f.owner
      if (f.size) params.size = f.size
      if (f.profile) params.profile = f.profile
      if (f.online) params.online = true
      if (this.sortField) {
        params.sortField = this.sortField
        params.sortOrder = this.sortOrder
      }
      return params
    },
    async load() {
      this.loading = true
      try {
        const data = await api.getRunners(this.buildParams())
        this.rows = data.items
        this.totalRecords = data.total
        this.lastRefresh = new Date().toLocaleTimeString()
      } catch (e) {
        this.toastError('Failed to load runners', e)
      } finally {
        this.loading = false
      }
    },
    async loadOptions() {
      try {
        const o = await api.getFilterOptions()
        this.options.owners = o.owners || []
        this.options.sizes = o.sizes || []
        this.options.profiles = o.profiles || []
        this.options.clouds = o.clouds || []
        this.options.targets = o.configuredTargets || []
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
      this.filters = { search: '', status: null, cloud: null, owner: null, size: null, profile: null, online: false }
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
    onRowClick(e) {
      this.openDetail(e.data)
    },
    openDetail(runner) {
      this.selected = runner
      this.detailVisible = true
    },
    openCreate() {
      this.createForm = { owner: null, size: null, profile: 'default' }
      this.createVisible = true
    },
    async submitCreate() {
      this.creating = true
      try {
        const res = await api.createRunner({
          owner: this.createForm.owner,
          size: this.createForm.size,
          profile: this.createForm.profile || 'default',
        })
        this.toast.add({ severity: 'success', summary: 'Runner queued', detail: res.message, life: 4000 })
        this.createVisible = false
        this.load()
      } catch (e) {
        this.toastError('Create failed', e)
      } finally {
        this.creating = false
      }
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
    confirmCleanup() {
      this.confirm.require({
        header: 'Clean up abandoned runners',
        message: 'Remove runners left in the "creation queued" state with no pending create task ' +
          '(leftovers of failed creation attempts, older than 15 min)? The orchestrator also does this automatically.',
        icon: 'pi pi-eraser',
        acceptLabel: 'Clean up',
        accept: async () => {
          try {
            const res = await api.cleanupStuckCreation()
            this.toast.add({ severity: 'success', summary: 'Cleanup done', detail: res.message, life: 4000 })
            this.load()
          } catch (e) {
            this.toastError('Cleanup failed', e)
          }
        },
      })
    },
    confirmKill() {
      this.confirm.require({
        header: 'Kill non-processing runners',
        message: 'This queues every runner that is NOT currently processing a job for deletion' +
          (this.filters.cloud ? ` on cloud "${this.filters.cloud}"` : '') + '. Continue?',
        icon: 'pi pi-bolt',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Kill them',
        accept: async () => {
          try {
            const res = await api.killNonProcessing(this.filters.cloud)
            this.toast.add({ severity: 'warn', summary: 'Cleanup queued', detail: res.message, life: 5000 })
            this.load()
          } catch (e) {
            this.toastError('Kill failed', e)
          }
        },
      })
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
    toastError(summary, e) {
      this.toast.add({ severity: 'error', summary, detail: apiErrorMessage(e), life: 5000 })
    },
  },
}
</script>

<style scoped>
.filter-select { width: 160px; }
.filter-select-sm { width: 130px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.online { background: var(--p-green-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-green-500) 25%, transparent); }
.dot.offline { background: var(--p-surface-600); }
.grafana-link { margin-left: 8px; color: var(--p-text-muted-color); }
.grafana-link:hover { color: var(--p-primary-300); }
.row-actions { display: flex; gap: 2px; justify-content: flex-end; }
.ops-table :deep(tbody tr) { cursor: pointer; }
.empty-state { padding: 2.5rem; text-align: center; color: var(--p-text-muted-color); }
.empty-state i { display: block; font-size: 2rem; margin-bottom: 0.5rem; }
.form-grid { display: grid; grid-template-columns: 110px 1fr; gap: 0.85rem; align-items: center; }
.form-grid label { font-size: 0.85rem; color: var(--p-text-muted-color); }
</style>
