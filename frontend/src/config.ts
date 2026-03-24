export const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.city.page'

export function apiUrl(path: string) {
  return `${API_BASE}${path}`
}
