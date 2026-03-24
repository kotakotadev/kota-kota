import { apiFetch, isLoggedIn } from '../auth'
import { makeAvatar } from '../components/navbar'
import { APP_NAME } from '../config'

export async function renderPost(el: HTMLElement, { city, id }: { city: string; id: string }) {
  el.innerHTML = `
    <header class="top-bar">
      <div class="top-bar-left">
        <a href="/${city}" data-link class="brand-name">${APP_NAME}</a>
        <span class="city-badge">${city}</span>
      </div>
    </header>
    <div class="post-detail-wrap">
      <a href="/${city}" data-link class="post-detail-back">← Back</a>
      <div id="post-content"><div class="loading">Loading…</div></div>
      <div id="comments-section"></div>
    </div>
  `

  const [postRes, commentsRes] = await Promise.all([
    apiFetch(`/${city}/posts/${id}`),
    apiFetch(`/${city}/posts/${id}/comments`)
  ])

  if (!postRes.ok) {
    el.querySelector('#post-content')!.innerHTML = '<p class="empty-state">Post not found.</p>'
    return
  }

  const post = await postRes.json()
  const comments: any[] = commentsRes.ok ? await commentsRes.json() : []
  const bodyClean = post.body.replace(/<!--citypage:.*?-->/gs, '').trim()
  const isAnon = post.author === 'anonymous'
  const authorLabel = isAnon ? 'Anonymous' : (post.author ?? 'unknown')
  const avatarEl = isAnon
    ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
    : makeAvatar(authorLabel)
  const categories = (post.labels ?? []).filter((l: any) => l.name !== 'post')

  el.querySelector('#post-content')!.innerHTML = `
    <div class="post-detail-main">
      <div class="post-left" style="align-items:center">
        ${avatarEl}
      </div>
      <div class="post-detail-content">
        <div class="post-header">
          <span class="post-username">${isAnon ? 'Anonymous' : `@${escHtml(authorLabel)}`}</span>
          <span class="post-time">${timeAgo(post.created_at)}</span>
        </div>
        ${categories.length ? `<span class="post-category-pill">${escHtml(categories[0].name)}</span>` : ''}
        <h1 class="post-detail-title">${escHtml(post.title)}</h1>
        <div class="post-detail-body">${renderMarkdown(bodyClean)}</div>
        <div class="post-detail-meta">
          <span>${new Date(post.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</span>
          <span>💬 ${post.comments} comment${post.comments !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  `

  renderComments(el.querySelector('#comments-section')!, comments, city, id)
}

function renderComments(container: HTMLElement, comments: any[], city: string, postId: string) {
  const commentsHtml = comments.map(c => {
    // Body format: "**@username**\n\ncontent\n\n<!--citypage-comment:...-->"
    const withoutMeta = c.body.replace(/<!--citypage-comment:.*?-->/gs, '').trim()
    const usernameMatch = withoutMeta.match(/^\*\*@([^\*]+)\*\*/)
    const name = usernameMatch ? usernameMatch[1] : (c.user?.login ?? 'user')
    const bodyClean = withoutMeta.replace(/^\*\*@[^\*]+\*\*\s*/,'').trim()
    return `
      <div class="comment-item">
        <div class="post-left">${makeAvatar(name, 30)}</div>
        <div class="comment-right">
          <div class="post-header">
            <span class="post-username" style="font-size:0.875rem">@${escHtml(name)}</span>
            <span class="post-time">${timeAgo(c.created_at)}</span>
          </div>
          <div class="comment-body">${renderMarkdown(bodyClean)}</div>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="comments-wrap">
      ${comments.length ? `<div class="comments-label">${comments.length} repl${comments.length !== 1 ? 'ies' : 'y'}</div>` : ''}
      ${commentsHtml}
      ${isLoggedIn()
        ? `<div class="comment-input-area">
             ${makeAvatar('me', 32)}
             <textarea class="comment-input" id="comment-input" placeholder="Add a reply…" rows="1"></textarea>
             <button class="comment-send-btn" id="comment-send">Reply</button>
           </div>
           <p id="comment-error" class="error-msg hidden" style="padding:0 1rem 0.5rem"></p>`
        : `<div class="login-to-comment">
             <a href="/login?city=${city}" data-link>Login to reply</a>
           </div>`
      }
    </div>
  `

  const input = container.querySelector<HTMLTextAreaElement>('#comment-input')
  input?.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = input.scrollHeight + 'px'
  })

  container.querySelector('#comment-send')?.addEventListener('click', async () => {
    const content = input?.value.trim()
    if (!content) return
    const res = await apiFetch(`/${city}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    })
    if (!res.ok) {
      const err = container.querySelector<HTMLElement>('#comment-error')!
      err.textContent = (await res.json()).error ?? 'Failed to post reply'
      err.classList.remove('hidden')
      return
    }
    const fresh = await apiFetch(`/${city}/posts/${postId}/comments`)
    const updated = fresh.ok ? await fresh.json() : []
    renderComments(container, updated, city, postId)
  })
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '<img src="$2" alt="$1" class="post-img" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>')
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
