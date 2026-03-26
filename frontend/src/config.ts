// In production all API calls are relative (/api/...) — proxied by CF Pages to the Worker.
// In dev, Vite proxies /api/* to localhost:8787 which has the Worker running.
export const API_BASE     = ''
export const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_URL ?? 'https://uploads.city.page'
export const APP_NAME     = import.meta.env.VITE_APP_NAME    ?? 'kotakota'

export function apiUrl(path: string) {
  return `/api${path}`
}

export function uploadsUrl(key: string) {
  return `${UPLOADS_BASE}/${key}`
}
