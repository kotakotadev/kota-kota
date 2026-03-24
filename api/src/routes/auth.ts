import { Hono } from 'hono'
import { signJWT } from '../lib/jwt'
import type { Bindings, Variables } from '../types'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

auth.post('/register', async (c) => {
  const { username, email, password, city_slug } = await c.req.json()
  if (!username || !email || !password || !city_slug) {
    return c.json({ error: 'Missing fields' }, 400)
  }

  const city = await c.env.DB.prepare(
    'SELECT id FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(city_slug).first<{ id: string }>()
  if (!city) return c.json({ error: 'City not found' }, 404)

  const hash = await hashPassword(password)
  const id = crypto.randomUUID()
  const now = Date.now()

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, city_id, username, email, password_hash, global_role, created_at)
       VALUES (?, ?, ?, ?, ?, 'visitor', ?)`
    ).bind(id, city.id, username, email, hash, now).run()
  } catch {
    return c.json({ error: 'Username or email already taken' }, 409)
  }

  return c.json({ message: 'Registered successfully' }, 201)
})

auth.post('/login', async (c) => {
  const { email, password, city_slug } = await c.req.json()
  if (!email || !password || !city_slug) return c.json({ error: 'Missing fields' }, 400)

  const city = await c.env.DB.prepare(
    'SELECT id FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(city_slug).first<{ id: string }>()
  if (!city) return c.json({ error: 'City not found' }, 404)

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash, global_role FROM users WHERE email = ? AND city_id = ?'
  ).bind(email, city.id).first<{ id: string; password_hash: string; global_role: string }>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const tokenId = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30

  await c.env.DB.prepare(
    'INSERT INTO sessions (token_id, city_id, user_id, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(tokenId, city.id, user.id, expiresAt).run()

  const token = await signJWT(
    { sub: user.id, city_id: city.id, role: user.global_role, jti: tokenId },
    c.env.JWT_SECRET
  )

  return c.json({ token })
})

auth.post('/logout', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ message: 'ok' })
  // Token revocation handled client-side by deleting token
  // For explicit revocation, parse token and set revoked = 1
  return c.json({ message: 'Logged out' })
})

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.randomUUID()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  )
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return `${salt}:${hash}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  )
  const candidate = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return candidate === hash
}

export default auth
