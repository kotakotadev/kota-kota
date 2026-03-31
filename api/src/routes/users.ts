import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /api/users/me
users.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const user = await c.env.DB.prepare(
    `SELECT id, username, avatar_url, is_verified, global_role, created_at FROM users WHERE id = ?`
  ).bind(userId).first()
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

// GET /api/users/me/posts — non-anonymous posts by the current user
users.get('/me/posts', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT pa.issue_number, ci.slug as city_slug, ci.name as city_name
     FROM post_authors pa JOIN cities ci ON ci.id = pa.city_id
     WHERE pa.user_id = ? AND pa.is_anonymous = 0
     ORDER BY pa.issue_number DESC
     LIMIT 30`
  ).bind(userId).all()
  return c.json(results)
})

// GET /api/users/me/liked — posts liked by the current user
users.get('/me/liked', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT pl.issue_number, ci.slug as city_slug, ci.name as city_name
     FROM post_likes pl JOIN cities ci ON ci.id = pl.city_id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC
     LIMIT 50`
  ).bind(userId).all()
  return c.json(results)
})

// POST /api/users/me/avatar — upload profile photo to R2
users.post('/me/avatar', authMiddleware, async (c) => {
  const userId = c.get('userId')
  let form: FormData
  try { form = await c.req.formData() } catch { return c.json({ error: 'Invalid form data' }, 400) }
  const file = form.get('avatar')
  if (!(file instanceof File)) return c.json({ error: 'No file' }, 400)
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'File too large (max 5 MB)' }, 400)
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return c.json({ error: 'Unsupported file type' }, 400)

  // Client always sends JPEG after canvas resize; force consistent content-type
  const contentType = file.type === 'image/gif' ? 'image/gif' : 'image/jpeg'
  const key = `avatars/${userId}`
  await c.env.R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } })
  const url = `${c.env.UPLOADS_URL}/${key}?v=${Date.now()}`
  await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(url, userId).run()
  return c.json({ url })
})

// GET /api/users/me/comments — comments posted by the current user
users.get('/me/comments', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT ca.comment_id, ca.issue_number, ca.body, ca.created_at,
            ci.slug as city_slug, ci.name as city_name
     FROM comment_authors ca JOIN cities ci ON ci.id = ca.city_id
     WHERE ca.user_id = ?
     ORDER BY ca.created_at DESC
     LIMIT 50`
  ).bind(userId).all()
  return c.json(results)
})

// GET /api/users/:username — public profile
users.get('/:username', async (c) => {
  const user = await c.env.DB.prepare(
    'SELECT username, is_verified, created_at FROM users WHERE username = ?'
  ).bind(c.req.param('username')).first()
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

export default users
