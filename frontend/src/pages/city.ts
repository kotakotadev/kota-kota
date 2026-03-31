import { apiFetch, isLoggedIn, getStoredProfile, getProfileAsync } from '../auth'
import { navigate } from '../router'
import { renderNotificationBell } from '../components/notifications'
import { getCityConfig, seedCityConfig } from '../lib/city-config'
import type { CityConfig } from '../lib/city-config'
import { renderNavbar, makeAvatar, initNavbarEvents } from '../components/navbar'
import { showLoginModal } from '../lib/login-modal'
import { t, tCat } from '../lib/i18n'

const PERSON_AVATAR_PLACEHOLDER = (size: number) =>
  `<div class="avatar" style="width:${size}px;height:${size}px;background:var(--separator);display:flex;align-items:center;justify-content:center"><svg width="${Math.round(size*0.55)}" height="${Math.round(size*0.55)}" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`

/** Consume SSR data if it matches this page/city — avoids loading flash */
function consumeSSR(page: string, city: string): any | null {
  const raw = (window as any).__SSR__
  if (!raw || raw.page !== page || raw.city !== city) return null
  delete (window as any).__SSR__
  return raw
}

export async function renderCity(el: HTMLElement, { city, tab = 'feed' }: { city: string; tab?: string }) {
  localStorage.setItem('citypage_city', city)
  const ssr = consumeSSR('city', city)

  let config: CityConfig

  if (ssr) {
    config = ssr.config
    seedCityConfig(city, config)
  } else {
    config = await getCityConfig(city)
  }

  document.documentElement.style.setProperty('--primary', config.theme.primary)

  if (!ssr) {
    el.innerHTML = `
      ${await renderNavbar(city, config)}
      <div class="feed-container">
        <div class="feed-tabs" id="feed-tabs">
          <button class="feed-tab active" data-tab="feed">${t('tab.feed')}</button>
          <button class="feed-tab" data-tab="trending">${t('tab.trending')}</button>
        </div>
        <div id="feed-panel">
          <div id="compose-bar"></div>
          <div class="feed-filters" id="feed-filters">
            <button class="filter-pill active" data-label="">${t('cat.all')}</button>
            ${config.categories.map(c => `<button class="filter-pill" data-label="${c}">${tCat(c)}</button>`).join('')}
          </div>
          <div id="posts-list"></div>
        </div>
        <div id="trending-panel" class="hidden">
          <div id="trending-list"></div>
        </div>
      </div>
      <div id="post-modal" class="modal hidden"></div>
    `
  } else {
    // SSR: feed content already in DOM — only swap navbar to reflect auth state
    const navbarHtml = await renderNavbar(city, config)
    const tmp = document.createElement('div')
    tmp.innerHTML = navbarHtml
    ;['.sidebar', '.top-bar', '.bottom-nav', '#change-city-modal'].forEach(sel => {
      const next = tmp.querySelector(sel)
      const prev = el.querySelector(sel)
      if (next && prev) prev.replaceWith(next)
    })
    // Translate SSR-rendered filter pills (SSR always outputs English)
    el.querySelectorAll<HTMLElement>('#feed-filters .filter-pill').forEach(pill => {
      const label = pill.dataset.label
      if (label === '') pill.textContent = t('cat.all')
      else if (label) pill.textContent = tCat(label)
    })
  }

  initNavbarEvents(el)

  const composeBar = el.querySelector<HTMLElement>('#compose-bar')
  if (composeBar) {
    composeBar.innerHTML = `
      <div class="compose-bar" id="compose-trigger">
        <div class="compose-bar-avatar" id="compose-avatar">${isLoggedIn() ? (() => { const p = getStoredProfile(); return p ? makeAvatar(p.username, 36, p.avatar_url) : PERSON_AVATAR_PLACEHOLDER(36) })() : PERSON_AVATAR_PLACEHOLDER(36)}</div>
        <div class="compose-bar-input">${t('compose.placeholder', { city: config.name || city })}</div>
      </div>
    `
    composeBar.querySelector('#compose-trigger')?.addEventListener('click', () => {
      if (!isLoggedIn()) { showLoginModal(city); return }
      navigate(`/${city}/new`)
    })
    if (isLoggedIn()) {
      getProfileAsync().then(p => {
        if (!p) return
        const avatarEl = composeBar.querySelector<HTMLElement>('#compose-avatar')
        if (avatarEl) avatarEl.innerHTML = makeAvatar(p.username, 36, p.avatar_url)
      })
    }
  }

  if (isLoggedIn()) {
    const notifEl = el.querySelector<HTMLElement>('#notif-bell')
    const notifElMobile = el.querySelector<HTMLElement>('#notif-bell-mobile')
    if (notifEl) renderNotificationBell(notifEl, city)
    if (notifElMobile) renderNotificationBell(notifElMobile, city)
    const doLogout = () => import('../auth').then(m => m.logout())
    el.querySelector('#btn-logout')?.addEventListener('click', doLogout)
    el.querySelector('#btn-logout-mobile')?.addEventListener('click', doLogout)
  }

  function switchTab(name: string) {
    el.querySelectorAll('.feed-tab').forEach(t =>
      t.classList.toggle('active', (t as HTMLElement).dataset.tab === name)
    )
    const feedPanel = el.querySelector<HTMLElement>('#feed-panel')!
    const trendingPanel = el.querySelector<HTMLElement>('#trending-panel')!
    if (name === 'feed') {
      feedPanel.classList.remove('hidden')
      trendingPanel.classList.add('hidden')
      history.replaceState(null, '', `/${city}`)
    } else {
      feedPanel.classList.add('hidden')
      trendingPanel.classList.remove('hidden')
      history.replaceState(null, '', `/${city}/trending`)
      loadTrendingPosts(el.querySelector('#trending-list')!, city)
    }
  }

  el.querySelector('#feed-tabs')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.feed-tab')
    if (!btn) return
    switchTab(btn.dataset.tab ?? 'feed')
  })

  if (tab === 'trending') switchTab('trending')

  let activeLabel = ''
  el.querySelector('#feed-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-pill')
    if (!btn) return
    el.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    activeLabel = btn.dataset.label ?? ''
    loadPosts(el.querySelector('#posts-list')!, city, activeLabel, 1)
  })

  const postsEl = el.querySelector<HTMLElement>('#posts-list')!
  if (ssr) {
    renderPostsList(postsEl, ssr.posts, city, 1, '')
  } else {
    loadPosts(postsEl, city, '', 1)
  }

  initPullToRefresh(el, postsEl, city, () => activeLabel)
}

function initPullToRefresh(root: HTMLElement, postsEl: HTMLElement, city: string, getLabel: () => string) {
  // Indicator sits above the posts list — compose bar and filters stay fixed.
  const indicator = document.createElement('div')
  indicator.className = 'ptr-indicator'
  postsEl.prepend(indicator)

  let startY = 0
  let pulling = false

  function snapBack(): Promise<void> {
    return new Promise(resolve => {
      postsEl.style.transition = 'transform 0.3s ease'
      postsEl.style.transform = 'translateY(0)'
      setTimeout(() => { postsEl.style.transition = ''; resolve() }, 310)
    })
  }

  root.addEventListener('touchstart', (e) => {
    if (window.scrollY > 0) return
    startY = e.touches[0].clientY
    pulling = false
  }, { passive: true })

  root.addEventListener('touchmove', (e) => {
    if (window.scrollY > 0) return
    const dy = e.touches[0].clientY - startY
    if (dy < 8) return
    pulling = true
    postsEl.style.transition = 'none'
    postsEl.style.transform = `translateY(${Math.min(dy * 0.45, 64)}px)`
    indicator.style.opacity = String(Math.min(dy / 80, 1))
    indicator.textContent = dy > 80 ? t('ptr.release') : t('ptr.pull')
  }, { passive: true })

  root.addEventListener('touchend', async () => {
    if (!pulling) return
    pulling = false

    indicator.textContent = t('ptr.loading')
    indicator.style.opacity = '1'
    await snapBack()

    const qs = new URLSearchParams({ page: '1', per_page: '20' })
    const label = getLabel()
    if (label) qs.set('label', label)
    const res = await apiFetch(`/${city}/posts?${qs}`)
    if (!res.ok) { indicator.style.opacity = '0'; return }

    const newPosts: any[] = await res.json()
    const currentFirst = postsEl.querySelector<HTMLElement>('.feed-post')
    const currentFirstId = currentFirst
      ? Number(currentFirst.querySelector('.post-like-btn')?.getAttribute('data-post'))
      : null
    const hasNew = newPosts.length > 0 && newPosts[0].number !== currentFirstId

    if (hasNew) {
      renderPostsList(postsEl, newPosts, city, 1, label)
      indicator.textContent = newPosts.length === 1 ? t('ptr.new', { n: 1 }) : t('ptr.newPlural', { n: newPosts.length })
    } else {
      indicator.textContent = t('ptr.noNew')
    }

    setTimeout(() => {
      indicator.style.transition = 'opacity 0.3s'
      indicator.style.opacity = '0'
      setTimeout(() => { indicator.style.transition = '' }, 300)
    }, 1500)
  })
}

const PER_PAGE = 20

let scrollObserver: IntersectionObserver | null = null

async function loadPosts(container: HTMLElement, city: string, label: string, page: number, append = false) {
  if (!append) {
    container.classList.add('feed-loading')
    const existing = container.querySelector('.feed-loading-bar')
    if (!existing) container.insertAdjacentHTML('afterbegin', '<div class="feed-loading-bar"></div>')
    scrollObserver?.disconnect()
    scrollObserver = null
  } else {
    container.querySelector('.feed-sentinel')?.remove()
  }

  const qs = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
  if (label) qs.set('label', label)
  const res = await apiFetch(`/${city}/posts?${qs}`)
  container.classList.remove('feed-loading')
  container.querySelector('.feed-loading-bar')?.remove()
  if (!res.ok) { container.innerHTML = `<p class="empty-state">${t('place.failedToPost')}</p>`; return }
  const posts: any[] = await res.json()
  renderPostsList(container, posts, city, page, label, append)
}

async function loadTrendingPosts(container: HTMLElement, city: string) {
  if (container.dataset.loaded) return
  container.classList.add('feed-loading')
  container.insertAdjacentHTML('afterbegin', '<div class="feed-loading-bar"></div>')
  const res = await apiFetch(`/${city}/posts?sort=trending`)
  container.classList.remove('feed-loading')
  container.querySelector('.feed-loading-bar')?.remove()
  if (!res.ok) { container.innerHTML = `<p class="empty-state">${t('place.failedToTrending')}</p>`; return }
  const posts: any[] = await res.json()
  container.dataset.loaded = '1'
  if (!posts.length) { container.innerHTML = `<p class="empty-state">${t('place.noTrending')}</p>`; return }
  renderPostsList(container, posts, city, 1, '', false, true)
}

const HEART_EMPTY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`

// ── Like state in localStorage ────────────────────────────────────────────────
function likedKey(city: string) { return `citypage_likes_${city}` }
function getLikedSet(city: string): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(likedKey(city)) ?? '[]')) }
  catch { return new Set() }
}
function persistLiked(city: string, id: number, liked: boolean) {
  const set = getLikedSet(city)
  liked ? set.add(id) : set.delete(id)
  localStorage.setItem(likedKey(city), JSON.stringify([...set]))
}

// Attach once per container — prevents duplicate handlers on append/filter change
function attachLikeHandler(container: HTMLElement, city: string) {
  if (container.dataset.likesbound) return
  container.dataset.likesbound = '1'
  container.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.post-like-btn')
    if (!btn) return
    if (!isLoggedIn()) { showLoginModal(city); return }
    const postId = Number(btn.dataset.post!)
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    const wasLiked = btn.dataset.liked === '1'
    // Optimistic update
    btn.dataset.liked = wasLiked ? '0' : '1'
    countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? -1 : 1))
    persistLiked(city, postId, !wasLiked)
    const res = await apiFetch(`/${city}/posts/${postId}/like`, { method: 'POST' })
    if (!res.ok) {
      // Revert on error
      btn.dataset.liked = wasLiked ? '1' : '0'
      countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? 1 : -1))
      persistLiked(city, postId, wasLiked)
    }
  })
}

function applyLikedState(container: HTMLElement, city: string, posts: any[]) {
  if (!isLoggedIn()) return
  // 1. Apply localStorage state immediately (instant, no flash)
  const local = getLikedSet(city)
  container.querySelectorAll<HTMLButtonElement>('.post-like-btn').forEach(btn => {
    const id = Number(btn.dataset.post)
    if (!local.has(id)) return
    btn.dataset.liked = '1'
    // API cache may still show 0 — ensure count is at least 1
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    if ((parseInt(countEl.textContent ?? '0') || 0) === 0) countEl.textContent = '1'
  })
  // 2. Sync with server in background to correct any drift
  const numbers = posts.map(p => p.number).join(',')
  apiFetch(`/${city}/posts/liked?issues=${numbers}`).then(async res => {
    if (!res.ok) return
    const liked: number[] = await res.json()
    const server = new Set(liked)
    const queried = new Set(posts.map(p => p.number))
    // Only touch buttons for posts we actually queried — don't clobber other pages
    container.querySelectorAll<HTMLButtonElement>('.post-like-btn').forEach(btn => {
      const id = Number(btn.dataset.post)
      if (!queried.has(id)) return
      const serverSays = server.has(id)
      btn.dataset.liked = serverSays ? '1' : '0'
      if (serverSays && (parseInt(btn.querySelector<HTMLElement>('.like-count')?.textContent ?? '0') || 0) === 0) {
        btn.querySelector<HTMLElement>('.like-count')!.textContent = '1'
      }
      persistLiked(city, id, serverSays)
    })
  })
}

function renderPostsList(container: HTMLElement, posts: any[], city: string, page: number, label: string, append = false, noInfiniteScroll = false) {
  if (!posts.length && !append) {
    container.innerHTML = `<p class="empty-state">${t('misc.noPostsFirst')}</p>`
    return
  }

  const html = posts.map(post => {
    const authorLabel = post.author === 'anonymous' ? 'anonymous' : (post.author ?? 'unknown')
    const isAnon = post.author === 'anonymous'
    const avatarEl = isAnon
      ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
      : makeAvatar(authorLabel, 36, post.avatar_url)
    const categories = (post.labels ?? []) as string[]
    return `
      <div class="feed-post feed-post-new" role="article">
        <div class="post-left">
          ${avatarEl}
          <div class="thread-line"></div>
        </div>
        <div class="post-right">
          <div class="post-header">
            <span class="post-username">${isAnon ? t('misc.anonymous') : `<a href="/${city}/@${escHtml(authorLabel)}" data-link>@${escHtml(authorLabel)}</a>`}</span>
            ${categories.length ? `<span class="post-category-pill">${tCat(categories[0])}</span>` : ''}
            <span class="post-time">${timeAgo(post.created_at)}</span>
          </div>
          <a href="/${city}/posts/${post.number}" data-link class="post-title-feed">${escHtml(post.title)}</a>
          <div class="post-actions">
            <a href="/${city}/posts/${post.number}" data-link class="post-action-btn">
              💬 <span>${post.comments}</span>
            </a>
            <button class="post-action-btn post-like-btn" data-post="${post.number}" data-liked="0">
              ${HEART_EMPTY}
              <span class="like-count">${post.like_count ?? 0}</span>
            </button>
          </div>
        </div>
      </div>
    `
  }).join('')

  if (append) {
    container.insertAdjacentHTML('beforeend', html)
    const newPosts = container.querySelectorAll<HTMLElement>('.feed-post-new')
    newPosts.forEach((p, i) => { p.style.animationDelay = `${i * 40}ms` })
  } else {
    container.innerHTML = html
  }

  attachLikeHandler(container, city)
  applyLikedState(container, city, posts)

  if (noInfiniteScroll || posts.length < PER_PAGE) return

  const sentinel = document.createElement('div')
  sentinel.className = 'feed-sentinel'
  container.appendChild(sentinel)

  scrollObserver?.disconnect()
  scrollObserver = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return
    scrollObserver?.disconnect()
    scrollObserver = null
    loadPosts(container, city, label, page + 1, true)
  }, { rootMargin: '200px' })
  scrollObserver.observe(sentinel)
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
