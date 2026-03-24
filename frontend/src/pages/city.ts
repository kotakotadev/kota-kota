import { apiFetch, isLoggedIn } from '../auth'
import { navigate } from '../router'
import { renderNotificationBell } from '../components/notifications'
import { getCityConfig } from '../lib/city-config'
import { renderNavbar } from '../components/navbar'

export async function renderCity(el: HTMLElement, { city }: { city: string }) {
  const config = await getCityConfig(city)

  // Apply city theme color
  document.documentElement.style.setProperty('--primary', config.theme.primary)

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <main class="city-layout">
      <aside class="filters">
        <h3>Filter</h3>
        <select id="filter-label">
          <option value="">All posts</option>
          ${config.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        ${config.districts.length ? `
          <h3 style="margin-top:1rem">District</h3>
          <select id="filter-district">
            <option value="">All districts</option>
            ${config.districts.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        ` : ''}
      </aside>
      <section id="posts-list" class="posts-list">
        <div class="loading">Loading posts...</div>
      </section>
    </main>
    <div id="post-modal" class="modal hidden"></div>
  `

  if (isLoggedIn()) {
    renderNotificationBell(el.querySelector('#notif-bell')!, city)
    el.querySelector('#btn-logout')?.addEventListener('click', () => {
      import('../auth').then(m => m.logout())
    })
    el.querySelector('#btn-new-post')?.addEventListener('click', () => {
      showNewPostModal(el.querySelector('#post-modal')!, city, config.categories)
    })
  }

  el.querySelector('#filter-label')?.addEventListener('change', (e) => {
    loadPosts(el.querySelector('#posts-list')!, city, (e.target as HTMLSelectElement).value)
  })

  await loadPosts(el.querySelector('#posts-list')!, city, '')
}

async function loadPosts(container: HTMLElement, city: string, label: string) {
  container.innerHTML = '<div class="loading">Loading...</div>'
  const qs = label ? `?label=${label}` : ''
  const res = await apiFetch(`/${city}/posts${qs}`)
  if (!res.ok) { container.innerHTML = '<p class="error">Failed to load posts</p>'; return }
  const posts: any[] = await res.json()

  if (!posts.length) {
    container.innerHTML = '<p class="empty">No posts yet. Be the first!</p>'
    return
  }

  container.innerHTML = posts.map(post => `
    <article class="post-card">
      <div class="post-meta">
        <span class="post-labels">${(post.labels ?? []).map((l: any) => `<span class="label">${l.name}</span>`).join('')}</span>
        <span class="post-date">${timeAgo(post.created_at)}</span>
      </div>
      <h2 class="post-title">
        <a href="/${city}/posts/${post.number}" data-link>${escHtml(post.title)}</a>
      </h2>
      <div class="post-footer">
        <span class="post-author">${post.author === 'anonymous' ? '🕵️ anonymous' : post.author ? `@${escHtml(post.author)}` : ''}</span>
        <span class="post-comments">💬 ${post.comments} comments</span>
      </div>
    </article>
  `).join('')
}

function showNewPostModal(modal: HTMLElement, city: string, categories: string[]) {
  modal.classList.remove('hidden')
  modal.innerHTML = `
    <div class="modal-box">
      <h2>New Post</h2>
      <form id="new-post-form">
        <input name="title" placeholder="Title" required />
        <textarea name="content" placeholder="What's on your mind?" rows="5" required></textarea>
        <select name="label">
          <option value="">No category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <label class="anon-toggle">
          <input type="checkbox" name="anonymous" />
          Post anonymously (for whistleblowing)
        </label>
        <div class="form-actions">
          <button type="button" id="cancel-post">Cancel</button>
          <button type="submit">Publish</button>
        </div>
        <p id="post-error" class="error hidden"></p>
      </form>
    </div>
  `

  modal.querySelector('#cancel-post')?.addEventListener('click', () => {
    modal.classList.add('hidden')
  })

  modal.querySelector('#new-post-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const body = {
      title: data.get('title'),
      content: data.get('content'),
      labels: data.get('label') ? [data.get('label')] : [],
      anonymous: data.get('anonymous') === 'on'
    }
    const res = await apiFetch(`/${city}/posts`, { method: 'POST', body: JSON.stringify(body) })
    if (!res.ok) {
      const err = modal.querySelector<HTMLElement>('#post-error')!
      err.textContent = (await res.json()).error ?? 'Failed to post'
      err.classList.remove('hidden')
      return
    }
    const { id } = await res.json()
    modal.classList.add('hidden')
    navigate(`/${city}/posts/${id}`)
  })
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
