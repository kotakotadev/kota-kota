import { createMiddleware } from 'hono/factory'
import { verifyJWT } from '../lib/jwt'
import type { Bindings, Variables } from '../types'

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = auth.slice(7)
    const payload = await verifyJWT(token, c.env.JWT_SECRET)
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401)

    // Check token is not revoked
    const session = await c.env.DB.prepare(
      'SELECT revoked FROM sessions WHERE token_id = ? AND user_id = ?'
    ).bind(payload.jti, payload.sub).first<{ revoked: number }>()

    if (!session || session.revoked) return c.json({ error: 'Session revoked' }, 401)

    c.set('userId', payload.sub)
    c.set('cityId', payload.city_id)
    c.set('globalRole', payload.role as Variables['globalRole'])
    await next()
  }
)

export const optionalAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const auth = c.req.header('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7)
      const payload = await verifyJWT(token, c.env.JWT_SECRET)
      if (payload) {
        const session = await c.env.DB.prepare(
          'SELECT revoked FROM sessions WHERE token_id = ? AND user_id = ?'
        ).bind(payload.jti, payload.sub).first<{ revoked: number }>()
        if (session && !session.revoked) {
          c.set('userId', payload.sub)
          c.set('cityId', payload.city_id)
          c.set('globalRole', payload.role as Variables['globalRole'])
        }
      }
    }
    await next()
  }
)

export const requireRole = (role: 'user' | 'superadmin') =>
  createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const userRole = c.get('globalRole')
    if (!userRole) return c.json({ error: 'Unauthorized' }, 401)
    if (role === 'superadmin' && userRole !== 'superadmin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    if (role === 'user' && userRole === 'visitor') {
      return c.json({ error: 'Forbidden — upgrade to user role to post' }, 403)
    }
    await next()
  })
