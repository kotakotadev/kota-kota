import { apiFetch, isLoggedIn } from '../auth'
import { navigate } from '../router'
import { renderNotificationBell } from '../components/notifications'
import { getCityConfig } from '../lib/city-config'
import type { CityConfig } from '../lib/city-config'
import { renderNavbar, makeAvatar } from '../components/navbar'

/** Consume SSR data if it matches this page/city — avoids loading flash */
function consumeSSR(page: string, city: string): any | null {
  const raw = (window as any).__SSR__
  if (!raw || raw.page !== page || raw.city !== city) return null
  delete (window as any).__SSR__
  return raw
}

export async function renderCity(el: HTMLElement, { city }: { city: string }) {
  const ssr = consumeSSR('city', city)

  let config: CityConfig
  let posts: any[]

  if (ssr) {
    config = ssr.config
    posts = ssr.posts
  } else {
    el.innerHTML = '<div class="loading">Loading…</div>'
    config = await getCityConfig(city)
    const res = await apiFetch(`/${city}/posts`)
    posts = res.ok ? await res.json() : []
  }

  document.documentElement.style.setProperty('--primary', config.theme.primary)

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <div class="feed-container">
      <div class="feed-filters" id="feed-filters">
        <button class="filter-pill active" data-label="">All</button>
        ${config.categories.map(c => `<button class="filter-pill" data-label="${c}">${c}</button>`).join('')}
      </div>
      <div id="posts-list"></div>
    </div>
    <div id="post-modal" class="modal hidden"></div>
  `

  if (isLoggedIn()) {
    renderNotificationBell(el.querySelector('#notif-bell')!, city)
    const doLogout = () => import('../auth').then(m => m.logout())
    el.querySelector('#btn-logout')?.addEventListener('click', doLogout)
    el.querySelector('#btn-logout-mobile')?.addEventListener('click', doLogout)
    const openModal = () => showNewPostModal(el.querySelector('#post-modal')!, city, config.categories)
    el.querySelector('#btn-new-post')?.addEventListener('click', openModal)
    el.querySelector('#bottom-compose')?.addEventListener('click', openModal)
  }

  let activeLabel = ''
  el.querySelector('#feed-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-pill')
    if (!btn) return
    el.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    activeLabel = btn.dataset.label ?? ''
    loadPosts(el.querySelector('#posts-list')!, city, activeLabel)
  })

  // Render posts — use SSR data for initial load (no flash), then client manages filters
  const postsEl = el.querySelector('#posts-list')!
  if (ssr) {
    renderPostsList(postsEl, posts, city)
  } else {
    await loadPosts(postsEl, city, '')
  }
}

async function loadPosts(container: HTMLElement, city: string, label: string) {
  container.innerHTML = '<div class="loading">Loading…</div>'
  const qs = label ? `?label=${label}` : ''
  const res = await apiFetch(`/${city}/posts${qs}`)
  if (!res.ok) { container.innerHTML = '<p class="empty-state">Failed to load posts.</p>'; return }
  const posts: any[] = await res.json()
  renderPostsList(container, posts, city)
}

function renderPostsList(container: HTMLElement, posts: any[], city: string) {
  if (!posts.length) {
    container.innerHTML = '<p class="empty-state">No posts yet — be the first!</p>'
    return
  }

  container.innerHTML = posts.map(post => {
    const authorLabel = post.author === 'anonymous' ? 'anonymous' : (post.author ?? 'unknown')
    const isAnon = post.author === 'anonymous'
    const avatarEl = isAnon
      ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
      : makeAvatar(authorLabel)
    const categories = (post.labels ?? []).filter((l: any) => l.name !== 'post')
    return `
      <div class="feed-post" role="article">
        <div class="post-left">
          ${avatarEl}
          <div class="thread-line"></div>
        </div>
        <div class="post-right">
          <div class="post-header">
            <span class="post-username">${isAnon ? 'Anonymous' : `@${escHtml(authorLabel)}`}</span>
            <span class="post-time">${timeAgo(post.created_at)}</span>
          </div>
          ${categories.length ? `<span class="post-category-pill">${escHtml(categories[0].name)}</span>` : ''}
          <a href="/${city}/posts/${post.number}" data-link class="post-title-feed">${escHtml(post.title)}</a>
          <div class="post-actions">
            <a href="/${city}/posts/${post.number}" data-link class="post-action-btn">
              💬 <span>${post.comments}</span>
            </a>
          </div>
        </div>
      </div>
    `
  }).join('')
}

function showNewPostModal(modal: HTMLElement, city: string, categories: string[]) {
  modal.classList.remove('hidden')
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">New Post</div>
      <form id="new-post-form" style="display:flex;flex-direction:column;gap:0.75rem">
        <input class="modal-input" name="title" placeholder="Title" required />
        <textarea class="modal-input modal-textarea" name="content" placeholder="What's happening in ${city}?" rows="4" required></textarea>
        <select class="modal-input modal-select" name="label">
          <option value="">No category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <label class="anon-toggle">
          <input type="checkbox" name="anonymous" />
          Post anonymously (whistleblow)
        </label>
        <p id="post-error" class="error-msg hidden"></p>
        <div class="modal-footer">
          <button type="button" class="modal-cancel" id="cancel-post">Cancel</button>
          <button type="submit" class="modal-publish">Publish</button>
        </div>
      </form>
    </div>
  `

  modal.querySelector('#cancel-post')?.addEventListener('click', () => modal.classList.add('hidden'))
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden') })

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
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
