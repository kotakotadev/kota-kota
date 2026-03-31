import { apiFetch, isLoggedIn, logout, getStoredProfile, getProfileAsync } from '../auth'
import { makeAvatar, renderNavbar, initNavbarEvents } from '../components/navbar'
import { getCityConfig, seedCityConfig } from '../lib/city-config'
import { renderNotificationBell } from '../components/notifications'
import { navigate } from '../router'
import { showLoginModal } from '../lib/login-modal'
import { trackView } from '../lib/view-tracker'
import { t, tp, tCat } from '../lib/i18n'

const PERSON_AVATAR_PLACEHOLDER = (size: number) =>
  `<div class="avatar" style="width:${size}px;height:${size}px;background:var(--separator);display:flex;align-items:center;justify-content:center"><svg width="${Math.round(size*0.55)}" height="${Math.round(size*0.55)}" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`

const HEART_EMPTY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`

function consumeSSR(page: string, city: string, postId: string): any | null {
  const raw = (window as any).__SSR__
  if (!raw || raw.page !== page || raw.city !== city || String(raw.postId) !== postId) return null
  delete (window as any).__SSR__
  return raw
}

export async function renderPost(el: HTMLElement, { city, id }: { city: string; id: string }) {
  const ssr = consumeSSR('post', city, id)
  const backHref = new URLSearchParams(location.search).get('back') ?? `/${city}`

  let post: any
  let comments: any[]

  if (ssr) {
    post = ssr.post
    comments = ssr.comments
    if (ssr.config) seedCityConfig(city, ssr.config)
  } else {
    const config = await getCityConfig(city)
    document.documentElement.style.setProperty('--primary', config.theme.primary)

    el.innerHTML = `
      ${await renderNavbar(city, config)}
      <div class="post-detail-wrap">
        <a href="${backHref}" data-link class="post-detail-back">${t('btn.back')}</a>
        <div id="post-content"><div class="loading">${t('misc.loading')}</div></div>
        <div id="comments-section"></div>
      </div>
    `

    initNavbarEvents(el)
    if (isLoggedIn()) {
      el.querySelector('#btn-logout')?.addEventListener('click', () => logout())
      el.querySelector('#btn-logout-mobile')?.addEventListener('click', () => logout())
    }

    const [postRes, commentsRes] = await Promise.all([
      apiFetch(`/${city}/posts/${id}`),
      apiFetch(`/${city}/posts/${id}/comments`)
    ])

    if (!postRes.ok) {
      el.querySelector('#post-content')!.innerHTML = `<p class="empty-state">${t('post.notFound')}</p>`
      return
    }

    post = await postRes.json()
    comments = commentsRes.ok ? await commentsRes.json() : []
  }

  const bodyClean = post.body?.replace(/<!--citypage:.*?-->/gs, '').trim() ?? ''
  const isAnon = post.author === 'anonymous'
  const authorLabel = isAnon ? t('misc.anonymous') : (post.author ?? 'unknown')
  const avatarEl = isAnon
    ? `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
    : makeAvatar(post.author ?? 'unknown', 36, post.avatar_url)
  const categories = (post.labels ?? []).filter((l: string) => l !== 'post')

  const postHtml = `
    <div class="post-detail-main">
      <div class="post-left" style="align-items:center">${avatarEl}</div>
      <div class="post-detail-content">
        <div class="post-header">
          <span class="post-username">${isAnon ? t('misc.anonymous') : `<a href="/${city}/@${escHtml(post.author)}?back=${encodeURIComponent(location.pathname)}" data-link>@${escHtml(post.author)}</a>`}</span>
          ${categories.length ? `<span class="post-category-pill">${tCat(categories[0])}</span>` : ''}
          <span class="post-time">${timeAgo(post.created_at)}</span>
        </div>
        <h1 class="post-detail-title">${escHtml(post.title)}</h1>
        <div class="post-detail-body">${renderMarkdown(bodyClean)}</div>
        <div class="post-detail-meta">
          <span>${new Date(post.created_at).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}</span>
          <span>💬 ${tp('post.reply', post.comments)}</span>
          ${post.view_count != null ? `<span>👁 ${post.view_count}</span>` : ''}
          <button class="post-action-btn post-like-btn" data-post="${post.number}" data-liked="0">
            ${HEART_EMPTY}<span class="like-count">${post.like_count ?? 0}</span>
          </button>
        </div>
      </div>
    </div>
  `

  if (ssr) {
    const config = await getCityConfig(city)
    const navbarHtml = await renderNavbar(city, config)
    const tmp = document.createElement('div')
    tmp.innerHTML = navbarHtml
    ;['.sidebar', '.top-bar', '.bottom-nav', '#change-city-modal'].forEach(sel => {
      const next = tmp.querySelector(sel)
      const prev = el.querySelector(sel)
      if (next && prev) prev.replaceWith(next)
    })
    initNavbarEvents(el)
    if (isLoggedIn()) {
      el.querySelector('#btn-logout')?.addEventListener('click', () => logout())
      el.querySelector('#btn-logout-mobile')?.addEventListener('click', () => logout())
      const notifEl = el.querySelector<HTMLElement>('#notif-bell')
      const notifElMobile = el.querySelector<HTMLElement>('#notif-bell-mobile')
      if (notifEl) renderNotificationBell(notifEl, city)
      if (notifElMobile) renderNotificationBell(notifElMobile, city)
    }
    const backLink = el.querySelector<HTMLAnchorElement>('.post-detail-back')
    if (backLink) backLink.href = backHref
    const postContentEl = el.querySelector('#post-content')
    if (postContentEl) postContentEl.innerHTML = postHtml
  } else {
    el.querySelector('#post-content')!.innerHTML = postHtml
    if (isLoggedIn()) {
      const notifEl = el.querySelector<HTMLElement>('#notif-bell')
      const notifElMobile = el.querySelector<HTMLElement>('#notif-bell-mobile')
      if (notifEl) renderNotificationBell(notifEl, city)
      if (notifElMobile) renderNotificationBell(notifElMobile, city)
    }
  }
  renderComments(el.querySelector('#comments-section')!, comments, city, id, isAnon ? null : post.author)
  initPostLike(el, city, post)
  setTimeout(() => trackView(city, post.number), 5000)
}

function initPostLike(el: HTMLElement, city: string, post: any) {
  const btn = el.querySelector<HTMLButtonElement>('.post-like-btn')
  if (!btn) return

  if (isLoggedIn()) {
    try {
      const liked: number[] = JSON.parse(localStorage.getItem(`citypage_likes_${city}`) ?? '[]')
      if (liked.includes(post.number)) {
        btn.dataset.liked = '1'
        const countEl = btn.querySelector<HTMLElement>('.like-count')!
        if ((parseInt(countEl.textContent ?? '0') || 0) === 0) countEl.textContent = '1'
      }
    } catch {}
  }

  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) { showLoginModal(city); return }
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    const wasLiked = btn.dataset.liked === '1'
    btn.dataset.liked = wasLiked ? '0' : '1'
    countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? -1 : 1))
    const res = await apiFetch(`/${city}/posts/${post.number}/like`, { method: 'POST' })
    if (!res.ok) {
      btn.dataset.liked = wasLiked ? '1' : '0'
      countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? 1 : -1))
    }
  })
}

function renderComments(container: HTMLElement, comments: any[], city: string, postId: string, postAuthor: string | null = null) {
  const commentsHtml = comments.map(c => {
    // API now returns pre-parsed {body, author} — no more client-side parsing needed
    const name = c.author ?? 'user'
    const isAuthor = postAuthor && name === postAuthor
    return `
      <div class="comment-item">
        <div class="post-left">${makeAvatar(name, 30, c.avatar_url)}</div>
        <div class="comment-right">
          <div class="post-header">
            <span class="post-username" style="font-size:0.875rem"><a href="/${city}/@${escHtml(name)}?back=${encodeURIComponent(location.pathname)}" data-link>@${escHtml(name)}</a></span>
            ${isAuthor ? `<span class="author-badge">${t('misc.author')}</span>` : ''}
            <span class="post-time">${timeAgo(c.created_at)}</span>
          </div>
          <div class="comment-body">${renderMarkdown(c.body ?? '')}</div>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="comments-wrap">
      ${comments.length ? `<div class="comments-label">${tp('post.reply', comments.length)}</div>` : ''}
      ${commentsHtml}
      ${isLoggedIn()
        ? `<div class="comment-input-area">
             <span id="comment-avatar">${(() => { const p = getStoredProfile(); return p ? makeAvatar(p.username, 32, p.avatar_url) : PERSON_AVATAR_PLACEHOLDER(32) })()}</span>
             <textarea class="comment-input" id="comment-input" placeholder="${t('post.replyPlaceholder')}" rows="1"></textarea>
             <button class="comment-send-btn" id="comment-send">${t('btn.reply')}</button>
           </div>
           <p id="comment-error" class="error-msg hidden" style="padding:0 1rem 0.5rem"></p>`
        : `<div class="login-to-comment">
             <a href="/login?city=${city}&redirect=${encodeURIComponent(location.pathname)}" data-link>${t('post.loginToReply')}</a>
           </div>`
      }
    </div>
  `

  if (isLoggedIn()) {
    getProfileAsync().then(p => {
      if (!p) return
      const avatarEl = container.querySelector<HTMLElement>('#comment-avatar')
      if (avatarEl) avatarEl.innerHTML = makeAvatar(p.username, 32, p.avatar_url)
    })
  }

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
      err.textContent = (await res.json()).error ?? t('post.failedToReply')
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
