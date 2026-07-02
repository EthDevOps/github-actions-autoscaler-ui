<template>
  <div v-if="runner" class="runner-detail">
    <div class="detail-header">
      <span :class="runner.isOnline ? 'dot online' : 'dot offline'" />
      <span class="mono detail-host">{{ runner.hostname }}</span>
      <Tag :severity="statusMeta.severity" :value="statusMeta.label" />
    </div>

    <div class="kv-grid">
      <div><span class="k">Runner ID</span><span class="v mono">{{ runner.runnerId }}</span></div>
      <div><span class="k">Cloud</span><span class="v">{{ runner.cloud }}</span></div>
      <div><span class="k">IPv4</span><span class="v mono">{{ runner.iPv4 || '—' }}</span></div>
      <div><span class="k">Arch</span><span class="v">{{ runner.arch || '—' }}</span></div>
      <div><span class="k">Size</span><span class="v">{{ runner.size }}</span></div>
      <div><span class="k">Profile</span><span class="v">{{ runner.profile }}</span></div>
      <div><span class="k">Owner</span><span class="v">{{ runner.owner }}</span></div>
      <div><span class="k">Stuck replacement</span><span class="v">{{ runner.stuckJobReplacement ? 'yes' : 'no' }}</span></div>
      <div><span class="k">Created</span><span class="v" v-tooltip="absolute(created)">{{ rel(created) }}</span></div>
      <div><span class="k">Last update</span><span class="v" v-tooltip="absolute(runner.lastStateTime)">{{ rel(runner.lastStateTime) }}</span></div>
    </div>

    <div class="detail-actions">
      <Button size="small" outlined icon="pi pi-copy" label="Copy SSH" :disabled="!runner.iPv4" @click="$emit('copy-ssh', runner.iPv4)" />
      <Button size="small" severity="danger" outlined icon="pi pi-trash" label="Delete runner"
        :disabled="terminal || !canMutate" @click="$emit('delete', runner)" />
    </div>

    <h3 class="detail-section">Job</h3>
    <div v-if="runner.job" class="kv-grid">
      <div>
        <span class="k">Repository</span>
        <a class="v link-plain" :href="`https://github.com/${runner.job.repository}`" target="_blank">{{ runner.job.repository }}</a>
      </div>
      <div><span class="k">State</span><span class="v"><Tag :severity="jobMeta.severity" :value="jobMeta.label" /></span></div>
      <div v-if="ghLoaded">
        <span class="k">Workflow</span>
        <a class="v link-plain" :href="githubJob.html_url" target="_blank">{{ githubJob.workflow_name }} → {{ githubJob.name }}</a>
      </div>
      <div v-if="ghLoaded"><span class="k">GitHub status</span><span class="v">{{ githubJob.status }} [{{ githubJob.conclusion }}]</span></div>
      <div v-if="ghLoaded"><span class="k">Branch</span><span class="v mono">{{ githubJob.head_branch }}</span></div>
    </div>
    <p v-else class="muted">No job assigned.</p>

    <h3 class="detail-section">Lifecycle</h3>
    <Timeline :value="lifecycle" class="detail-timeline">
      <template #marker="{ item }">
        <span class="tl-marker" :style="{ background: markerColor(item.status) }" />
      </template>
      <template #content="{ item }">
        <div class="tl-row">
          <div>
            <Tag :severity="statusMetaFor(item.status).severity" :value="statusMetaFor(item.status).label" />
            <div class="tl-event">{{ item.event }}</div>
          </div>
          <span class="muted tl-time" v-tooltip="absolute(item.eventTimeUtc)">{{ rel(item.eventTimeUtc) }}</span>
        </div>
      </template>
    </Timeline>
  </div>
</template>

<script>
import axios from 'axios'
import { runnerStatusMeta, jobStateMeta, relativeTime, absoluteTime, sortedLifecycle } from '../format'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Timeline from 'primevue/timeline'

export default {
  name: 'RunnerDetail',
  components: { Tag, Button, Timeline },
  props: {
    runner: { type: Object, default: null },
    canMutate: { type: Boolean, default: true },
  },
  emits: ['copy-ssh', 'delete'],
  data() {
    return { ghLoaded: false, githubJob: {} }
  },
  computed: {
    lifecycle() {
      return sortedLifecycle(this.runner)
    },
    created() {
      return this.lifecycle[0]?.eventTimeUtc
    },
    statusMeta() {
      return runnerStatusMeta(this.runner?.lastState)
    },
    jobMeta() {
      return jobStateMeta(this.runner?.job?.state)
    },
    terminal() {
      return [5, 6].includes(this.runner?.lastState)
    },
  },
  watch: {
    runner: {
      immediate: true,
      handler() {
        this.ghLoaded = false
        this.githubJob = {}
        if (this.runner?.job?.jobUrl) this.loadGitHubJob()
      },
    },
  },
  methods: {
    rel: relativeTime,
    absolute: absoluteTime,
    statusMetaFor: runnerStatusMeta,
    markerColor(status) {
      const map = { success: 'var(--p-green-500)', info: 'var(--p-sky-500)', warn: 'var(--p-amber-500)', danger: 'var(--p-red-500)', secondary: 'var(--p-surface-500)' }
      return map[runnerStatusMeta(status).severity] || 'var(--p-primary-500)'
    },
    async loadGitHubJob() {
      try {
        const resp = await axios.get(this.runner.job.jobUrl)
        this.githubJob = resp.data
        this.ghLoaded = true
      } catch {
        this.ghLoaded = false
      }
    },
  },
}
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
}
.detail-host { font-size: 1rem; font-weight: 600; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dot.online { background: var(--p-green-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-green-500) 25%, transparent); }
.dot.offline { background: var(--p-surface-500); }
.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem 1.25rem;
}
.kv-grid > div { display: flex; flex-direction: column; padding: 0.35rem 0; border-bottom: 1px solid var(--p-surface-800); }
.k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--p-text-muted-color); }
.v { font-size: 0.9rem; margin-top: 2px; }
.detail-actions { display: flex; gap: 0.5rem; margin: 1rem 0; }
.detail-section { font-size: 0.9rem; margin: 1.5rem 0 0.75rem; }
.tl-marker { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 2px solid var(--p-surface-900); }
.tl-row { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: 0.9rem; }
.tl-event { font-size: 0.8rem; color: var(--p-text-muted-color); margin-top: 4px; max-width: 340px; }
.tl-time { white-space: nowrap; }
</style>
