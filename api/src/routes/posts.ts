import { Hono } from 'hono'
import { authMiddleware, optionalAuth, requireRole } from '../middleware/auth'
import { listIssues, getIssue, createIssue, closeIssue, buildPostBody } from '../lib/github'
import type { Bindings, Variables } from '../types'

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Resolve city + repo from slug param
async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; github_repo: string }>()
}

// GET /:city/posts
posts.get('/', optionalAuth, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const { label, page = '1' } = c.req.query()
  const params: Record<string, string> = { page, per_page: '20' }
  if (label) params.labels = label

  const issues = await listIssues(c.env.GITHUB_BOT_TOKEN, city.github_repo, params)
  return c.json(issues)
})

// GET /:city/posts/:id
posts.get('/:id', optionalAuth, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const issue = await getIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, Number(c.req.param('id')))
  return c.json(issue)
})

// POST /:city/posts
posts.post('/', authMiddleware, requireRole('user'), async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const { title, content, labels = [], anonymous = false, tenant_id } = await c.req.json()
  if (!title || !content) return c.json({ error: 'Missing title or content' }, 400)

  const userId = c.get('userId')

  const body = buildPostBody(content, {
    anonymous,
    author_id: anonymous ? undefined : userId,
    tenant_id: tenant_id ?? undefined
  })

  const issue = await createIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, {
    title,
    body,
    labels: ['post', ...labels]
  })

  // Store private author mapping
  await c.env.DB.prepare(
    `INSERT INTO post_authors (issue_number, city_id, user_id, tenant_id, is_anonymous, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(issue.number, city.id, userId, tenant_id ?? null, anonymous ? 1 : 0, Date.now()).run()

  return c.json({ id: issue.number, url: issue.html_url }, 201)
})

// DELETE /:city/posts/:id — close issue (superadmin or post author)
posts.delete('/:id', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const issueNumber = Number(c.req.param('id'))
  const userId = c.get('userId')
  const role = c.get('globalRole')

  if (role !== 'superadmin') {
    const author = await c.env.DB.prepare(
      'SELECT user_id FROM post_authors WHERE issue_number = ? AND city_id = ?'
    ).bind(issueNumber, city.id).first<{ user_id: string }>()
    if (!author || author.user_id !== userId) return c.json({ error: 'Forbidden' }, 403)
  }

  await closeIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, issueNumber)
  return c.json({ message: 'Post removed' })
})

export default posts
