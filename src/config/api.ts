// API configuration for PDF converter backend
const _base: string = import.meta.env.VITE_API_URL || ''

/** Builds a full API URL from a path, e.g. apiUrl('/api/unlock-pdf') */
export const apiUrl = (path: string) => `${_base}${path}`

/** True only when a real (non-localhost) backend URL is configured */
export const BACKEND_AVAILABLE =
  !!_base && !_base.includes('localhost') && !_base.includes('127.0.0.1')
