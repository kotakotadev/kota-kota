import { apiFetch, isLoggedIn, getUser } from '../auth'

export async function renderPost(el: HTMLElement, { city, id }: { city: string; id: string }) {
  el.innerHTML = `
    <nav class="navbar">
      <a href="/${city}" data-link>← Back to ${city}</a>
    </nav>
    <main class="post-detail">
      <div id="post-content" class="loading">Loading post...</div>
      <section id="comments-section"></section>
    </main>
  `

  const [postRes, commentsRes] = await Promise.all([
    apiFetch(`/${city}/posts/${id}`),
    apiFetch(`/${city}/posts/${id}/comments`)
  ])

  if (!postRes.ok) {
    el.querySelector('#post-content')!.innerHTML = '<p class="error">Post not found</p>'
    return
  }

  const post = await postRes.json()
  const comments: any[] = commentsRes.ok ? await commentsRes.json() : []

  // Parse metadata from issue body
  const bodyClean = post.body.replace(/<!--citypage:.*?-->/gs, '').trim()

  el.querySelector('#post-content')!.innerHTML = `
    <article class="post-full">
      <div class="post-labels">
        ${(post.labels ?? []).map((l: any) => `<span class="label">${l.name}</span>`).join('')}
      </div>
      <h1>${escHtml(post.title)}</h1>
      <div class="post-body">${renderMarkdown(bodyClean)}</div>
      <div class="post-meta-bar">
        <span>${post.author === 'anonymous' ? '🕵️ anonymous' : post.author ? `@${escHtml(post.author)}` : ''}</span>
        <span>${timeAgo(post.created_at)}</span>
        <span>💬 ${post.comments} comments</span>
      </div>
    </article>
  `

  renderComments(el.querySelector('#comments-section')!, comments, city, id)
}

function renderComments(container: HTMLElement, comments: any[], city: string, postId: string) {
  const user = getUser()

  container.innerHTML = `
    <h2>${comments.length} Comments</h2>
    <div id="comments-list">
      ${comments.map(c => {
        const bodyClean = c.body.replace(/<!--citypage-comment:.*?-->/gs, '').trim()
        return `
          <div class="comment">
            <div class="comment-body">${renderMarkdown(bodyClean)}</div>
            <span class="comment-date">${timeAgo(c.created_at)}</span>
          </div>
        `
      }).join('')}
    </div>
    ${isLoggedIn() ? `
      <form id="comment-form" class="comment-form">
        <textarea name="content" placeholder="Write a comment..." rows="3" required></textarea>
        <button type="submit">Post Comment</button>
        <p id="comment-error" class="error hidden"></p>
      </form>
    ` : `<p><a href="/login?city=${city}" data-link>Login to comment</a></p>`}
  `

  container.querySelector('#comment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value
    const res = await apiFetch(`/${city}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    })
    if (!res.ok) {
      const err = container.querySelector<HTMLElement>('#comment-error')!
      err.textContent = (await res.json()).error ?? 'Failed to comment'
      err.classList.remove('hidden')
      return
    }
    // Reload comments
    const fresh = await apiFetch(`/${city}/posts/${postId}/comments`)
    const updated = fresh.ok ? await fresh.json() : []
    renderComments(container, updated, city, postId)
  })
}

// Minimal markdown: bold, italic, code, line breaks
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
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
