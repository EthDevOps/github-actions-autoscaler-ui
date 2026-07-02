import axios from 'axios'

const client = axios.create({
  // Empty base URL => same-origin requests (nginx / vite dev proxy forwards /api).
  baseURL: import.meta.env.VITE_API_URL || '',
})

const apiKey = import.meta.env.VITE_API_KEY

// The viewer sits behind Teleport for access control, so the shared API key is
// baked into the bundle at build time and sent on every orchestrator request.
client.interceptors.request.use((config) => {
  if (apiKey) {
    config.headers['X-API-KEY'] = apiKey
  }
  return config
})

const unwrap = (p) => p.then((r) => r.data)

// Human-friendly message for a failed request, with special-casing for auth failures.
export function apiErrorMessage(e) {
  const status = e?.response?.status
  if (status === 401) return 'Not authenticated — sign in through Teleport.'
  if (status === 403) return 'Not authorized — this action needs an elevated Teleport role.'
  return e?.response?.data?.message || e?.message || 'Unknown error'
}

export const api = {
  getMe: () => unwrap(client.get('/api/me')),
  getRunners: (params) => unwrap(client.get('/api/get-runners', { params })),
  getJobs: (params) => unwrap(client.get('/api/get-jobs', { params })),
  getStuckJobs: () => unwrap(client.get('/api/get-stuck-jobs')),
  getStats: () => unwrap(client.get('/api/stats')),
  getFilterOptions: () => unwrap(client.get('/api/filter-options')),
  getRunner: (id) => unwrap(client.get(`/api/get-runner/${id}`)),
  getJob: (id) => unwrap(client.get(`/api/get-job/${id}`)),
  getPotentialRunners: (jobId) => unwrap(client.get(`/api/get-potential-runners/${jobId}`)),

  // Actions
  deleteRunner: (id) => unwrap(client.post(`/api/runners/${id}/delete`)),
  createRunner: (body) => unwrap(client.post('/api/runners', body)),
  rescheduleJob: (id) => unwrap(client.post(`/api/jobs/${id}/reschedule`)),
  cancelJob: (id) => unwrap(client.post(`/api/jobs/${id}/cancel`)),
  killNonProcessing: (cloud) =>
    unwrap(client.post('/api/kill-non-processing-runners', null, { params: cloud ? { cloud } : {} })),
  clearCreationQueue: () => unwrap(client.post('/api/clear-creation-queue')),
  cleanupStuckCreation: (olderThanMinutes) =>
    unwrap(client.post('/api/cleanup-stuck-creation', null, {
      params: olderThanMinutes != null ? { olderThanMinutes } : {},
    })),
}

export default client
