import { apiUrl } from './config'

export type AuthUser = {
  id: string
  username: string
  global_role: 'superadmin' | 'user' | 'visitor'
  is_verified: number
  city_id: string
}

const TOKEN_KEY = 'citypage_token'
const USER_KEY  = 'citypage_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  return fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  })
}

export async function login(email: string, password: string, citySlug: string): Promise<void> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, city_slug: citySlug })
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Login failed')
  const { token } = await res.json()
  // Decode user from JWT payload (middle segment)
  const payload = JSON.parse(atob(token.split('.')[1]))
  saveSession(token, {
    id: payload.sub,
    username: '',           // fetch from /users/me if needed
    global_role: payload.role,
    is_verified: 0,
    city_id: payload.city_id
  })
}

export async function register(username: string, email: string, password: string, citySlug: string): Promise<void> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, city_slug: citySlug })
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Registration failed')
}

export function logout() {
  clearSession()
  window.location.href = '/'
}
