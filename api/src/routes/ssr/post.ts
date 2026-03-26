import { Hono } from 'hono'
import { htmlShell, makeAvatar, escHtml, timeAgo } from '../../lib/html'
import { getCityConfig } from '../../lib/city-config'
import { renderMarkdown } from '../../lib/markdown'
import { withCache } from '../../lib/cache'
import { getIssue, listComments } from '../../lib/github'
import type { Bindings, Variables } from '../../types'

const ssrPost = new Hono<{ Bindings: Bindings; Variables: Variables }>()

async function getCityRow(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id, github_repo FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string; github_repo: string }>()
}

ssrPost.get('/:city/posts/:id', async (c) => {
  const citySlug = c.req.param('city')
  const postId = Number(c.req.param('id'))

  return withCache(c.req.raw, c.executionCtx, async () => {
    const [city, config] = await Promise.all([
      getCityRow(c.env.DB, citySlug),
      getCityConfig(c.env.GITHUB_ORG, citySlug)
    ])
    if (!city) return c.html('', 404)

    const [issue, comments] = await Promise.all([
      getIssue(c.env.GITHUB_BOT_TOKEN, city.github_repo, postId) as Promise<any>,
      listComments(c.env.GITHUB_BOT_TOKEN, city.github_repo, postId) as Promise<any[]>
    ])

    if (!issue) return c.html('<p>Post not found.</p>', 404)

    // Enrich post with author
    const authorRow = await c.env.DB.prepare(
      `SELECT pa.is_anonymous, u.username
       FROM post_authors pa LEFT JOIN users u ON u.id = pa.user_id
       WHERE pa.city_id = ? AND pa.issue_number = ?`
    ).bind(city.id, postId).first<{ is_anonymous: number; username: string | null }>()
    const isAnon = authorRow?.is_anonymous ? true : false
    const authorLabel = isAnon ? 'Anonymous' : (authorRow?.username ?? issue.user?.login ?? 'unknown')

    const bodyClean = issue.body?.replace(/<!--citypage:.*?-->/gs, '').trim() ?? ''
    const categories = (issue.labels ?? []).filter((l: any) => l.name !== 'post')

    const avatarEl = isAnon
      ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
      : makeAvatar(authorLabel)

    // Render comments
    const commentsHtml = comments.map((comment: any) => {
      const withoutMeta = comment.body?.replace(/<!--citypage-comment:.*?-->/gs, '').trim() ?? ''
      const usernameMatch = withoutMeta.match(/^\*\*@([^*]+)\*\*/)
      const name = usernameMatch ? usernameMatch[1] : (comment.user?.login ?? 'user')
      const bodyClean = withoutMeta.replace(/^\*\*@[^*]+\*\*\s*/, '').trim()
      return `
        <div class="comment-item">
          <div class="post-left">${makeAvatar(name, 30)}</div>
          <div class="comment-right">
            <div class="post-header">
              <span class="post-username" style="font-size:0.875rem">@${escHtml(name)}</span>
              <span class="post-time">${timeAgo(comment.created_at)}</span>
            </div>
            <div class="comment-body">${renderMarkdown(bodyClean)}</div>
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
      <div class="post-detail-wrap">
        <a href="/${citySlug}" data-link class="post-detail-back">← Back</a>
        <div id="post-content">
          <div class="post-detail-main">
            <div class="post-left" style="align-items:center">${avatarEl}</div>
            <div class="post-detail-content">
              <div class="post-header">
                <span class="post-username">${isAnon ? 'Anonymous' : `@${escHtml(authorLabel)}`}</span>
                <span class="post-time">${timeAgo(issue.created_at)}</span>
              </div>
              ${categories.length ? `<span class="post-category-pill">${escHtml(categories[0].name)}</span>` : ''}
              <h1 class="post-detail-title">${escHtml(issue.title)}</h1>
              <div class="post-detail-body">${renderMarkdown(bodyClean)}</div>
              <div class="post-detail-meta">
                <span>${new Date(issue.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                <span>💬 ${issue.comments} comment${issue.comments !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
        <div id="comments-section">
          <div class="comments-wrap">
            ${comments.length ? `<div class="comments-label">${comments.length} repl${comments.length !== 1 ? 'ies' : 'y'}</div>` : ''}
            ${commentsHtml}
            <div class="login-to-comment" id="comment-login-prompt">
              <a href="/login?city=${citySlug}" data-link>Login to reply</a>
            </div>
          </div>
        </div>
      </div>`

    return c.html(htmlShell({
      title: `${escHtml(issue.title)} — ${escHtml(config.name || citySlug)}`,
      description: bodyClean.slice(0, 160),
      content,
      appUrl: c.env.APP_URL,
      appName: c.env.APP_NAME,
      ssrPage: 'post',
      ssrInlineData: {
        page: 'post',
        city: citySlug,
        postId,
        post: { ...issue, author: isAnon ? 'anonymous' : authorLabel },
        comments,
        config
      },
      primaryColor: config.theme.primary
    }))
  }, 30)
})

export default ssrPost
