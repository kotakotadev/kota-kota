import { Hono } from 'hono'
import { authMiddleware, optionalAuth, requireRole } from '../middleware/auth'
import { listIssues, getIssue, createIssue, closeIssue, buildPostBody } from '../lib/github'
import { withCache, purgeCache } from '../lib/cache'
import type { Bindings, Variables } from '../types'

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Internal label names that are implementation details — never exposed to clients
const INTERNAL_LABELS = new Set(['post', 'citypage-post'])

/** Strip all GitHub-specific fields. Returns only what the client needs. */
function shapePost(issue: any) {
  return {
    number:     issue.number,
    title:      issue.title,
    body:       issue.body ?? '',
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    comments:   issue.comments ?? 0,
    labels:     (issue.labels ?? [])
                  .map((l: any) => typeof l === 'string' ? l : l.name)
                  .filter((n: string) => !INTERNAL_LABELS.has(n)),
    author:     issue.author ?? null,
    avatar_url: issue.avatar_url ?? null,
    like_count: issue.like_count ?? 0,
    ...(issue.view_count  != null ? { view_count:  issue.view_count }  : {}),
    ...(issue.trend_count != null ? { trend_count: issue.trend_count } : {}),
  }
}

async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; github_repo: string }>()
}

async function enrichWithAuthors(db: D1Database, cityId: string, issues: any[]) {
  if (!issues.length) return issues
  const numbers = issues.map(i => i.number)
  const placeholders = numbers.map(() => '?').join(',')
  const rows = await db.prepare(
    `SELECT pa.issue_number, pa.is_anonymous, u.username, u.avatar_url
     FROM post_authors pa
     LEFT JOIN users u ON u.id = pa.user_id
     WHERE pa.city_id = ? AND pa.issue_number IN (${placeholders})`
  ).bind(cityId, ...numbers).all<{ issue_number: number; is_anonymous: number; username: string | null; avatar_url: string | null }>()

  const map = new Map(rows.results.map(r => [r.issue_number, r]))
  return issues.map(issue => {
    const a = map.get(issue.number)
    return {
      ...issue,
      author:     a ? (a.is_anonymous ? 'anonymous' : (a.username ?? 'unknown')) : null,
      avatar_url: a && !a.is_anonymous ? (a.avatar_url ?? null) : null,
    }
  })
}

async function enrichWithLikeCounts(db: D1Database, cityId: string, issues: any[]) {
  if (!issues.length) return issues
  const numbers = issues.map(i => i.number)
  const placeholders = numbers.map(() => '?').join(',')
  const { results } = await db.prepare(
    `SELECT issue_number, COUNT(*) as like_count FROM post_likes WHERE city_id = ? AND issue_number IN (${placeholders}) GROUP BY issue_number`
  ).bind(cityId, ...numbers).all<{ issue_number: number; like_count: number }>()
  const map = new Map(results.map(r => [r.issue_number, r.like_count]))
  return issues.map(i => ({ ...i, like_count: map.get(i.number) ?? 0 }))
}

// GET /:city/posts — cached 30s (trending: 60s)
posts.get('/', optionalAuth, async (c) => {
  const { sort } = c.req.query()
  return withCache(c.req.raw, c.executionCtx, async () => {
    const city = await getCity(c.env.DB, c.req.param('city'))
    if (!city) return c.json({ error: 'City not found' }, 404)

    const { label, page = '1' } = c.req.query()

    if (sort === 'trending') {
      const since = Date.now() - 24 * 60 * 60 * 1000
      const { results: trending } = await c.env.DB.prepare(
        `SELECT issue_number, COUNT(*) as trend_count FROM post_likes
         WHERE city_id = ? AND created_at > ?
         GROUP BY issue_number ORDER BY trend_count DESC LIMIT 20`
      ).bind(city.id, since).all<{ issue_number: number; trend_count: number }>()

      if (!trending.length) return c.json([])

      const trendMap = new Map(trending.map(r => [r.issue_number, r.trend_count]))
      const issues = await Promise.all(
        trending.map(r => getIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, r.issue_number))
      )
      let enriched = await enrichWithAuthors(c.env.DB, city.id, issues)
      enriched = await enrichWithLikeCounts(c.env.DB, city.id, enriched)
      enriched = enriched.map((p: any) => ({ ...p, trend_count: trendMap.get(p.number) ?? 0 }))
      enriched.sort((a: any, b: any) => b.trend_count - a.trend_count)
      return c.json(enriched.map(shapePost))
    }

    const params: Record<string, string> = { page, per_page: '20' }
    params.labels = label ? `citypage-post,${label}` : 'citypage-post'
    const issues = await listIssues(c.env.GITHUB_BOT_TOKEN, city.github_repo, params)
    let enriched = await enrichWithAuthors(c.env.DB, city.id, issues)
    enriched = await enrichWithLikeCounts(c.env.DB, city.id, enriched)
    return c.json(enriched.map(shapePost))
  }, sort === 'trending' ? 60 : 30)
})

// GET /:city/posts/liked — which of the given post numbers are liked by current user
posts.get('/liked', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)
  const userId = c.get('userId')
  const issues = (c.req.query('issues') ?? '').split(',').map(Number).filter(Boolean)
  if (!issues.length) return c.json([])
  const placeholders = issues.map(() => '?').join(',')
  const { results } = await c.env.DB.prepare(
    `SELECT issue_number FROM post_likes WHERE city_id = ? AND user_id = ? AND issue_number IN (${placeholders})`
  ).bind(city.id, userId, ...issues).all<{ issue_number: number }>()
  return c.json(results.map(r => r.issue_number))
})

// GET /:city/posts/:id — cached 30s
posts.get('/:id', optionalAuth, async (c) => {
  return withCache(c.req.raw, c.executionCtx, async () => {
    const city = await getCity(c.env.DB, c.req.param('city'))
    if (!city) return c.json({ error: 'City not found' }, 404)

    const postId = Number(c.req.param('id'))
    const [issue, viewRow] = await Promise.all([
      getIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, postId),
      c.env.DB.prepare(
        'SELECT view_count FROM post_view_counts WHERE city_id = ? AND issue_number = ?'
      ).bind(city.id, postId).first<{ view_count: number }>()
    ])
    let [enriched] = await enrichWithAuthors(c.env.DB, city.id, [issue])
    ;[enriched] = await enrichWithLikeCounts(c.env.DB, city.id, [enriched])
    enriched = { ...enriched, view_count: viewRow?.view_count ?? 0 }
    return c.json(shapePost(enriched))
  }, 30)
})

// POST /:city/posts/:id/like — toggle like/unlike
posts.post('/:id/like', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)
  const postNumber = Number(c.req.param('id'))
  const userId = c.get('userId')
  const existing = await c.env.DB.prepare(
    'SELECT 1 FROM post_likes WHERE user_id = ? AND city_id = ? AND issue_number = ?'
  ).bind(userId, city.id, postNumber).first()
  if (existing) {
    await c.env.DB.prepare(
      'DELETE FROM post_likes WHERE user_id = ? AND city_id = ? AND issue_number = ?'
    ).bind(userId, city.id, postNumber).run()
    return c.json({ liked: false })
  }
  await c.env.DB.prepare(
    'INSERT INTO post_likes (user_id, city_id, issue_number, created_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, city.id, postNumber, Date.now()).run()
  return c.json({ liked: true })
})

// POST /:city/posts
posts.post('/', authMiddleware, requireRole('user'), async (c) => {
  const citySlug = c.req.param('city')
  const city = await getCity(c.env.DB, citySlug)
  if (!city) return c.json({ error: 'City not found' }, 404)

  const { title, content, labels = [], anonymous = false, tenant_id } = await c.req.json()
  if (!title || !content) return c.json({ error: 'Missing title or content' }, 400)

  const userId = c.get('userId')
  const body = buildPostBody(content, {
    anonymous,
    author_id: anonymous ? undefined : userId,
    tenant_id: tenant_id ?? undefined
  })

  let issue: any
  try {
    issue = await createIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, {
      title,
      body,
      labels: ['citypage-post', ...labels]
    })
  } catch (err: any) {
    console.error('createIssue failed:', err.message)
    return c.json({ error: 'Failed to create post' }, 502)
  }

  await c.env.DB.prepare(
    `INSERT INTO post_authors (issue_number, city_id, user_id, tenant_id, is_anonymous, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(issue.number, city.id, userId, tenant_id ?? null, anonymous ? 1 : 0, Date.now()).run()

  c.executionCtx.waitUntil(
    purgeCache([`${c.env.API_URL}/api/${citySlug}/posts`])
  )

  return c.json({ id: issue.number }, 201)
})

// DELETE /:city/posts/:id
posts.delete('/:id', authMiddleware, async (c) => {
  const citySlug = c.req.param('city')
  const city = await getCity(c.env.DB, citySlug)
  if (!city) return c.json({ error: 'City not found' }, 404)

  const postNumber = Number(c.req.param('id'))
  const userId = c.get('userId')
  const role = c.get('globalRole')

  if (role !== 'superadmin') {
    const author = await c.env.DB.prepare(
      'SELECT user_id FROM post_authors WHERE issue_number = ? AND city_id = ?'
    ).bind(postNumber, city.id).first<{ user_id: string }>()
    if (!author || author.user_id !== userId) return c.json({ error: 'Forbidden' }, 403)
  }

  await closeIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, postNumber)

  c.executionCtx.waitUntil(
    purgeCache([
      `${c.env.API_URL}/api/${citySlug}/posts`,
      `${c.env.API_URL}/api/${citySlug}/posts/${postNumber}`
    ])
  )

  return c.json({ message: 'Post removed' })
})

export default posts
