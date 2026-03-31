import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { listComments, createComment, deleteComment } from '../lib/github'
import type { Bindings, Variables } from '../types'

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>()

async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; github_repo: string }>()
}

/** Strip GitHub-specific fields from a comment. Parses author from the embedded body prefix. */
function shapeComment(comment: any) {
  const rawBody: string = comment.body ?? ''
  // Strip the citypage metadata tag first
  const withoutMeta = rawBody.replace(/<!--citypage-comment:.*?-->/gs, '').trim()
  // Extract author name from **@username** or **username** prefix line
  const authorMatch = withoutMeta.match(/^\*\*@?([^*\n]+?)\*\*/)
  const author = authorMatch ? authorMatch[1].trim() : null
  // Strip the prefix line to get the actual message body
  const body = withoutMeta.replace(/^\*\*@?[^*]+\*\*[^\n]*\n+/, '').trim()

  return {
    id:         comment.id,
    body,
    author,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  }
}

// GET /:city/posts/:id/comments
comments.get('/', async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const data = await listComments(c.env.GITHUB_BOT_TOKEN, city.github_repo, Number(c.req.param('postId')))
  const shaped = data.map(shapeComment)

  // Enrich with avatar_url from D1
  if (shaped.length) {
    const ids = shaped.map(c => c.id)
    const placeholders = ids.map(() => '?').join(',')
    const { results } = await c.env.DB.prepare(
      `SELECT ca.comment_id, u.avatar_url
       FROM comment_authors ca LEFT JOIN users u ON u.id = ca.user_id
       WHERE ca.comment_id IN (${placeholders})`
    ).bind(...ids).all<{ comment_id: number; avatar_url: string | null }>()
    const avatarMap = new Map(results.map(r => [r.comment_id, r.avatar_url]))
    return c.json(shaped.map(c => ({ ...c, avatar_url: avatarMap.get(c.id) ?? null })))
  }

  return c.json(shaped)
})

// POST /:city/posts/:id/comments
comments.post('/', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const { content } = await c.req.json()
  if (!content) return c.json({ error: 'Missing content' }, 400)

  const userId = c.get('userId')
  const user = await c.env.DB.prepare(
    'SELECT username FROM users WHERE id = ?'
  ).bind(userId).first<{ username: string }>()

  const rawBody = `**${user?.username ?? 'user'}** _(via kotakota)_\n\n${content}\n\n<!--citypage-comment:{"author_id":"${userId}"}-->`

  const comment = await createComment(
    c.env.GITHUB_BOT_TOKEN,
    city.github_repo,
    Number(c.req.param('postId')),
    rawBody
  )

  // Store comment metadata in D1 so we can list a user's comments later
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO comment_authors (comment_id, issue_number, city_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(comment.id, Number(c.req.param('postId')), city.id, userId, content, Date.now()).run()

  return c.json({ id: comment.id }, 201)
})

// DELETE /:city/posts/:id/comments/:commentId
comments.delete('/:commentId', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const role = c.get('globalRole')
  if (role !== 'superadmin') return c.json({ error: 'Forbidden' }, 403)

  await deleteComment(c.env.GITHUB_BOT_TOKEN, city.github_repo, Number(c.req.param('commentId')))
  return c.json({ message: 'Comment deleted' })
})

export default comments
