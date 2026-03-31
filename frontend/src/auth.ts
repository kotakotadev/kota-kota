import { apiUrl } from './config'

export type AuthUser = {
  id: string
  username: string
  global_role: 'superadmin' | 'user' | 'visitor'
  is_verified: number
}

const TOKEN_KEY   = 'citypage_token'
const USER_KEY    = 'citypage_user'
const PROFILE_KEY = 'citypage_profile'

export type StoredProfile = { username: string; avatar_url: string | null }

// Pending resolvers waiting for the first profile fetch
const _profileWaiters: Array<(p: StoredProfile | null) => void> = []
let _profileResolved = false

export function getStoredProfile(): StoredProfile | null {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') } catch { return null }
}

/**
 * Waits for the live /users/me fetch to complete (called once per page load from main.ts).
 * On subsequent SPA navigations the fetch is already done, so resolves immediately from cache.
 */
export function getProfileAsync(): Promise<StoredProfile | null> {
  if (_profileResolved) return Promise.resolve(getStoredProfile())
  return new Promise(res => _profileWaiters.push(res))
}

export function storeProfile(username: string, avatar_url: string | null) {
  const profile: StoredProfile = { username, avatar_url }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  _profileResolved = true
  _profileWaiters.splice(0).forEach(r => r(profile))
}

/** Call this if the profile fetch fails so waiters don't hang forever. */
export function resolveProfileNull() {
  _profileResolved = true
  _profileWaiters.splice(0).forEach(r => r(null))
}

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
  localStorage.removeItem(PROFILE_KEY)
  // Remove per-city user data (likes, viewed posts)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('citypage_likes_') || key.startsWith('citypage_viewed_'))) {
      localStorage.removeItem(key)
    }
  }
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

export async function login(email: string, password: string, citySlug?: string): Promise<string | null> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, city_slug: citySlug })
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Login failed')
  const data = await res.json()
  const { token } = data
  // Decode user from JWT payload (middle segment)
  const payload = JSON.parse(atob(token.split('.')[1]))
  saveSession(token, {
    id: payload.sub,
    username: '',           // fetch from /users/me if needed
    global_role: payload.role,
    is_verified: 0,
  })
  return data.city_slug ?? null
}

export async function register(username: string, email: string, password: string, citySlug?: string): Promise<string | null> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, city_slug: citySlug })
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Registration failed')
  const data = await res.json()
  return data.city_slug ?? null
}

export function logout() {
  clearSession()
  window.location.href = '/'
}
