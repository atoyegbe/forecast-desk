import type { BackendHealth } from './types'

const BACKEND_HEALTH_URL = import.meta.env.VITE_BACKEND_HEALTH_URL ?? '/health'

export async function getBackendHealth() {
  const response = await fetch(BACKEND_HEALTH_URL)

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return (await response.json()) as BackendHealth
}
