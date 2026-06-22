// API configuration for PDF converter backend
const _base: string = import.meta.env.VITE_API_URL || ''

/** Builds a full API URL from a path, e.g. apiUrl('/api/unlock-pdf') */
export const apiUrl = (path: string) => `${_base}${path}`

/** True when a backend API URL is configured (including localhost for local dev) */
export const BACKEND_AVAILABLE = !!_base.trim()
