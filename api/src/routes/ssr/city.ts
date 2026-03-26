import { Hono } from 'hono'
import { htmlShell, makeAvatar, escHtml, timeAgo } from '../../lib/html'
import { getCityConfig } from '../../lib/city-config'
import { withCache } from '../../lib/cache'
import { listIssues } from '../../lib/github'
import type { Bindings, Variables } from '../../types'

const ssrCity = new Hono<{ Bindings: Bindings; Variables: Variables }>()

async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, name, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; name: string; github_repo: string }>()
}

async function enrichWithAuthors(db: D1Database, cityId: string, issues: any[]) {
  if (!issues.length) return issues
  const numbers = issues.map((i: any) => i.number)
  const placeholders = numbers.map(() => '?').join(',')
  const rows = await db.prepare(
    `SELECT pa.issue_number, pa.is_anonymous, u.username
     FROM post_authors pa LEFT JOIN users u ON u.id = pa.user_id
     WHERE pa.city_id = ? AND pa.issue_number IN (${placeholders})`
  ).bind(cityId, ...numbers).all<{ issue_number: number; is_anonymous: number; username: string | null }>()
  const map = new Map(rows.results.map(r => [r.issue_number, r]))
  return issues.map((issue: any) => {
    const a = map.get(issue.number)
    return { ...issue, author: a ? (a.is_anonymous ? 'anonymous' : (a.username ?? 'unknown')) : null }
  })
}

ssrCity.get('/:city', async (c) => {
  const citySlug = c.req.param('city')

  // Skip known non-city paths
  if (['login', 'register', 'api', 'assets'].includes(citySlug)) return c.notFound()

  return withCache(c.req.raw, c.executionCtx, async () => {
    const [city, config] = await Promise.all([
      getCity(c.env.DB, citySlug),
      getCityConfig(c.env.GITHUB_ORG, citySlug)
    ])
    if (!city) return c.html('', 404)

    const issues = await listIssues(c.env.GITHUB_BOT_TOKEN, city.github_repo, { per_page: '20' }) as any[]
    const posts = await enrichWithAuthors(c.env.DB, city.id, issues)

    const filterPills = [
      `<button class="filter-pill active" data-label="">All</button>`,
      ...config.categories.map(cat =>
        `<button class="filter-pill" data-label="${escHtml(cat)}">${escHtml(cat)}</button>`
      )
    ].join('')

    const postCards = posts.map((post: any) => {
      const isAnon = post.author === 'anonymous'
      const authorLabel = isAnon ? 'anonymous' : (post.author ?? 'unknown')
      const avatar = isAnon
        ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
        : makeAvatar(authorLabel)
      const categories = (post.labels ?? []).filter((l: any) => l.name !== 'post')
      return `
        <div class="feed-post" role="article">
          <div class="post-left">${avatar}<div class="thread-line"></div></div>
          <div class="post-right">
            <div class="post-header">
              <span class="post-username">${isAnon ? 'Anonymous' : `@${escHtml(authorLabel)}`}</span>
              <span class="post-time">${timeAgo(post.created_at)}</span>
            </div>
            ${categories.length ? `<span class="post-category-pill">${escHtml(categories[0].name)}</span>` : ''}
            <a href="/${citySlug}/posts/${post.number}" data-link class="post-title-feed">${escHtml(post.title)}</a>
            <div class="post-actions">
              <a href="/${citySlug}/posts/${post.number}" data-link class="post-action-btn">
                💬 <span>${post.comments}</span>
              </a>
            </div>
          </div>
        </div>`
    }).join('')

    const content = `
      <header class="top-bar">
        <div class="top-bar-left">
          <a href="/" data-link class="brand-name">${escHtml(c.env.APP_NAME)}</a>
          <a href="/${citySlug}" data-link class="city-badge">${escHtml(config.name || citySlug)}</a>
        </div>
        <div class="top-bar-right" id="auth-area" data-city="${escHtml(citySlug)}">
          <a href="/login?city=${citySlug}" data-link class="top-bar-link">Login</a>
          <a href="/register?city=${citySlug}" data-link class="top-bar-btn">Join</a>
        </div>
      </header>
      <nav class="bottom-nav" id="bottom-nav" data-city="${escHtml(citySlug)}">
        <a href="/${citySlug}" data-link class="bottom-nav-item active">
          <span class="nav-icon">⌂</span><span>Home</span>
        </a>
        <a href="/" data-link class="bottom-nav-item">
          <span class="nav-icon">◎</span><span>Cities</span>
        </a>
        <a href="/login?city=${citySlug}" data-link class="bottom-nav-item bottom-nav-compose" id="bottom-compose">
          <span>✎</span>
        </a>
        <a href="/${citySlug}/tenants" data-link class="bottom-nav-item">
          <span class="nav-icon">⊞</span><span>Places</span>
        </a>
        <a href="/login?city=${citySlug}" data-link class="bottom-nav-item">
          <span class="nav-icon">👤</span><span>Login</span>
        </a>
      </nav>
      <div class="feed-container">
        <div class="feed-filters" id="feed-filters">${filterPills}</div>
        <div id="posts-list">${postCards || '<p class="empty-state">No posts yet — be the first!</p>'}</div>
      </div>
      <div id="post-modal" class="modal hidden"></div>`

    return c.html(htmlShell({
      title: `${config.name || citySlug} — ${c.env.APP_NAME}`,
      description: `Community discussions for ${config.name || citySlug}`,
      content,
      appUrl: c.env.APP_URL,
      appName: c.env.APP_NAME,
      ssrPage: 'city',
      ssrInlineData: { page: 'city', city: citySlug, config, posts },
      primaryColor: config.theme.primary
    }))
  }, 30)
})

export default ssrCity
