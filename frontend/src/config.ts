export const API_BASE     = import.meta.env.VITE_API_URL     ?? 'https://api.city.page'
export const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_URL ?? 'https://uploads.city.page'
export const APP_NAME     = import.meta.env.VITE_APP_NAME    ?? 'city.page'

export function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

export function uploadsUrl(key: string) {
  return `${UPLOADS_BASE}/${key}`
}
