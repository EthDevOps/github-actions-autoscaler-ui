import { reactive } from 'vue'
import { api } from './api'

// Identity of the current user as reported by the orchestrator (/api/me), derived from
// the verified Teleport JWT. Shared across views to gate mutating action buttons.
export const session = reactive({
  loaded: false,
  authEnabled: false,
  authenticated: false,
  user: null,
  roles: [],
  // Optimistic default: if auth is disabled or /api/me is unreachable, allow actions
  // (the backend still enforces authorization and returns 403 otherwise).
  canMutate: true,
})

export async function loadSession() {
  try {
    const me = await api.getMe()
    session.authEnabled = !!me.authEnabled
    session.authenticated = !!me.authenticated
    session.user = me.user || null
    session.roles = me.roles || []
    session.canMutate = me.canMutate !== false
  } catch {
    // Leave canMutate optimistic; backend remains authoritative.
    session.canMutate = true
  } finally {
    session.loaded = true
  }
}
