import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { listComments, createComment, deleteComment } from '../lib/github'
import type { Bindings, Variables } from '../types'

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>()

async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; github_repo: string }>()
}

// GET /:city/posts/:id/comments
comments.get('/', async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const data = await listComments(c.env.GITHUB_BOT_TOKEN, city.github_repo, Number(c.req.param('postId')))
  return c.json(data)
})

// POST /:city/posts/:id/comments — all authenticated users (including visitor)
comments.post('/', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const { content } = await c.req.json()
  if (!content) return c.json({ error: 'Missing content' }, 400)

  const userId = c.get('userId')
  const user = await c.env.DB.prepare(
    'SELECT username FROM users WHERE id = ?'
  ).bind(userId).first<{ username: string }>()

  const body = `**@${user?.username ?? 'user'}**\n\n${content}\n\n<!--citypage-comment:{"author_id":"${userId}"}-->`

  const comment = await createComment(
    c.env.GITHUB_BOT_TOKEN,
    city.github_repo,
    Number(c.req.param('postId')),
    body
  )

  return c.json({ id: comment.id }, 201)
})

// DELETE /:city/posts/:id/comments/:commentId
comments.delete('/:commentId', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const role = c.get('globalRole')
  // Only superadmin can delete any comment; others can only delete their own
  // (ownership check would require fetching the comment first — kept simple for now)
  if (role !== 'superadmin') return c.json({ error: 'Forbidden' }, 403)

  await deleteComment(c.env.GITHUB_BOT_TOKEN, city.github_repo, Number(c.req.param('commentId')))
  return c.json({ message: 'Comment deleted' })
})

export default comments
