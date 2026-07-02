// Shared formatting helpers: state metadata (label + PrimeVue Tag severity +
// icon) and relative/absolute time rendering.

const EMPTY_DATE = '0001-01-01T00:00:00'

export function isEmptyDate(ts) {
  return !ts || ts.startsWith('0001-01-01')
}

const RUNNER_STATUS = {
  0: { label: 'Unknown', severity: 'secondary', icon: 'pi pi-question-circle' },
  1: { label: 'Creation queued', severity: 'warn', icon: 'pi pi-hourglass' },
  2: { label: 'Created', severity: 'info', icon: 'pi pi-cog' },
  3: { label: 'Provisioned', severity: 'info', icon: 'pi pi-check-circle' },
  4: { label: 'Processing', severity: 'success', icon: 'pi pi-play-circle' },
  5: { label: 'Deletion queued', severity: 'warn', icon: 'pi pi-trash' },
  6: { label: 'Deleted', severity: 'secondary', icon: 'pi pi-times-circle' },
  7: { label: 'Failure', severity: 'danger', icon: 'pi pi-exclamation-triangle' },
  8: { label: 'Vanished on cloud', severity: 'danger', icon: 'pi pi-eye-slash' },
  9: { label: 'Cleanup', severity: 'secondary', icon: 'pi pi-sparkles' },
  10: { label: 'Cancelled', severity: 'secondary', icon: 'pi pi-ban' },
}

const JOB_STATE = {
  0: { label: 'Unknown', severity: 'secondary', icon: 'pi pi-question-circle' },
  1: { label: 'Queued', severity: 'warn', icon: 'pi pi-hourglass' },
  2: { label: 'In progress', severity: 'info', icon: 'pi pi-play-circle' },
  3: { label: 'Completed', severity: 'success', icon: 'pi pi-check-circle' },
  4: { label: 'Vanished', severity: 'secondary', icon: 'pi pi-eye-slash' },
  5: { label: 'Cancelled', severity: 'secondary', icon: 'pi pi-ban' },
  6: { label: 'Throttled', severity: 'danger', icon: 'pi pi-clock' },
}

export function runnerStatusMeta(code) {
  return RUNNER_STATUS[code] ?? RUNNER_STATUS[0]
}

export function jobStateMeta(code) {
  return JOB_STATE[code] ?? JOB_STATE[0]
}

export const runnerStatusOptions = Object.entries(RUNNER_STATUS).map(([value, m]) => ({
  value: Number(value),
  label: m.label,
}))

export const jobStateOptions = Object.entries(JOB_STATE).map(([value, m]) => ({
  value: Number(value),
  label: m.label,
}))

// Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
export function relativeTime(ts) {
  if (isEmptyDate(ts)) return '—'
  const then = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z')
  const diffMs = Date.now() - then.getTime()
  if (Number.isNaN(diffMs)) return '—'
  const abs = Math.abs(diffMs)
  const suffix = diffMs >= 0 ? 'ago' : 'from now'
  const s = Math.round(abs / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ${suffix}`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ${suffix}`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ${suffix}`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ${suffix}`
  return `${Math.round(mo / 12)}y ${suffix}`
}

// Human duration between two timestamps (or ts -> now), e.g. "5m 12s".
export function durationSince(ts) {
  if (isEmptyDate(ts)) return '—'
  const then = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z')
  let s = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000))
  const parts = []
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!d && !h) parts.push(`${s}s`)
  return parts.join(' ')
}

export function absoluteTime(ts) {
  if (isEmptyDate(ts)) return 'N/A'
  const d = new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z')
  return d.toLocaleString()
}

export function sortedLifecycle(runner) {
  if (!runner?.lifecycle) return []
  return [...runner.lifecycle].sort(
    (a, b) => new Date(a.eventTimeUtc) - new Date(b.eventTimeUtc),
  )
}

export { EMPTY_DATE }
