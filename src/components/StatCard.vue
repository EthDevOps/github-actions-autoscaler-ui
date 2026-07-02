<template>
  <div class="stat-card" :class="tone ? `tone-${tone}` : ''" @click="$emit('click')" :style="clickable ? 'cursor:pointer' : ''">
    <div class="stat-icon"><i :class="icon" /></div>
    <div class="stat-body">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">{{ value }}</div>
      <div v-if="sub" class="stat-sub">{{ sub }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatCard',
  props: {
    label: String,
    value: [String, Number],
    icon: { type: String, default: 'pi pi-chart-bar' },
    sub: String,
    tone: { type: String, default: '' }, // '', 'primary', 'success', 'warn', 'danger', 'info'
    clickable: Boolean,
  },
  emits: ['click'],
}
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  background: var(--p-surface-900);
  border: 1px solid var(--p-surface-800);
  border-radius: 12px;
  transition: border-color 0.15s, transform 0.15s;
}
.stat-card:hover {
  border-color: var(--p-surface-700);
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 10px;
  font-size: 1.25rem;
  background: var(--p-surface-800);
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.stat-label {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
  font-weight: 600;
}
.stat-value {
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.15;
}
.stat-sub {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.tone-primary .stat-icon { background: color-mix(in srgb, var(--p-primary-500) 22%, transparent); color: var(--p-primary-300); }
.tone-success .stat-icon { background: color-mix(in srgb, var(--p-green-500) 20%, transparent); color: var(--p-green-400); }
.tone-warn .stat-icon    { background: color-mix(in srgb, var(--p-amber-500) 20%, transparent); color: var(--p-amber-400); }
.tone-danger .stat-icon  { background: color-mix(in srgb, var(--p-red-500) 20%, transparent); color: var(--p-red-400); }
.tone-info .stat-icon    { background: color-mix(in srgb, var(--p-sky-500) 20%, transparent); color: var(--p-sky-400); }
.tone-danger { border-color: color-mix(in srgb, var(--p-red-500) 40%, var(--p-surface-800)); }
</style>
