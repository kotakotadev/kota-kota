import { apiFetch, isLoggedIn, logout } from '../auth'
import { makeAvatar, avatarColor, renderNavbar, initNavbarEvents } from '../components/navbar'
import { getCityConfig } from '../lib/city-config'
import { renderNotificationBell } from '../components/notifications'
import { showLoginModal } from '../lib/login-modal'
import { t, tp } from '../lib/i18n'

const HEART_EMPTY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`

export async function renderCityUser(el: HTMLElement, { city, username }: { city: string; username: string }) {
  const config = await getCityConfig(city)
  document.documentElement.style.setProperty('--primary', config.theme.primary)
  const backHref = new URLSearchParams(location.search).get('back') ?? `/${city}`

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <div class="post-detail-wrap">
      <a href="${backHref}" data-link class="post-detail-back">${t('btn.back')}</a>
      <div id="user-profile-card"><div class="loading">${t('misc.loading')}</div></div>
      <div id="user-tabs-wrap"></div>
    </div>
  `

  initNavbarEvents(el)
  el.querySelector('#btn-logout')?.addEventListener('click', () => logout())
  el.querySelector('#btn-logout-mobile')?.addEventListener('click', () => logout())
  if (isLoggedIn()) {
    const notifEl = el.querySelector<HTMLElement>('#notif-bell')
    const notifElMobile = el.querySelector<HTMLElement>('#notif-bell-mobile')
    if (notifEl) renderNotificationBell(notifEl, city)
    if (notifElMobile) renderNotificationBell(notifElMobile, city)
  }

  const [profileRes, postsRes, likedRes] = await Promise.all([
    apiFetch(`/users/${username}`),
    apiFetch(`/${city}/users/${username}/posts`),
    apiFetch(`/${city}/users/${username}/liked`)
  ])

  if (!profileRes.ok) {
    el.querySelector('#user-profile-card')!.innerHTML = `<p class="empty-state">${t('user.notFound')}</p>`
    return
  }

  const user: any = await profileRes.json()
  const postList: any[] = postsRes.ok ? await postsRes.json() : []
  const likedList: any[] = likedRes.ok ? await likedRes.json() : []

  const bg = avatarColor(user.username)
  const initials = user.username.slice(0, 2).toUpperCase()
  const joined = new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  el.querySelector('#user-profile-card')!.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar" style="background:${bg}">${initials}</div>
      <div class="profile-info">
        <div class="profile-username">
          @${escHtml(user.username)}
          ${user.is_verified ? '<span class="profile-verified">✓</span>' : ''}
        </div>
        <div class="profile-meta"><span>${t('profile.joined', { date: joined })}</span></div>
      </div>
    </div>
  `

  const tabsWrap = el.querySelector('#user-tabs-wrap')!
  tabsWrap.innerHTML = `
    <div class="feed-tabs" id="user-tabs">
      <button class="feed-tab active" data-tab="posts">${t('tab.posts')}</button>
      <button class="feed-tab" data-tab="liked">${t('tab.liked')}</button>
    </div>
    <div id="tab-posts"></div>
    <div id="tab-liked" class="hidden"></div>
  `

  tabsWrap.querySelectorAll('.feed-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsWrap.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const tab = (btn as HTMLElement).dataset.tab!
      tabsWrap.querySelector('#tab-posts')!.classList.toggle('hidden', tab !== 'posts')
      tabsWrap.querySelector('#tab-liked')!.classList.toggle('hidden', tab !== 'liked')
    })
  })

  const cityLabel = escHtml(config.name || city)
  const backParam = encodeURIComponent(location.pathname + location.search)

  // ── Posts tab ────────────────────────────────────────────────────────────────
  const postsEl = tabsWrap.querySelector('#tab-posts') as HTMLElement
  if (!postList.length) {
    postsEl.innerHTML = `<p class="empty-state">${t('misc.noPostsYet')}</p>`
  } else {
    const details = await Promise.all(
      postList.map((p: any) => apiFetch(`/${city}/posts/${p.issue_number}`).then(r => r.ok ? r.json() : null))
    )
    postsEl.innerHTML = `
      <div class="profile-posts-label">${tp('profile.postsIn', postList.length, { city: cityLabel })}</div>
      ${postList.map((p: any, i: number) => {
        const post = details[i]
        if (!post) return ''
        return `
          <div class="feed-post" role="article">
            <div class="post-left">${makeAvatar(user.username, 36, user.avatar_url)}<div class="thread-line"></div></div>
            <div class="post-right">
              <div class="post-header">
                <span class="post-username">@${escHtml(user.username)}</span>
                <span class="post-time">${timeAgo(post.created_at)}</span>
              </div>
              <a href="/${city}/posts/${p.issue_number}?back=${backParam}" data-link class="post-title-feed">${escHtml(post.title)}</a>
              <div class="post-actions">
                <a href="/${city}/posts/${p.issue_number}?back=${backParam}" data-link class="post-action-btn">
                  💬 <span>${post.comments}</span>
                </a>
                <button class="post-action-btn post-like-btn" data-post="${post.number}" data-city="${city}" data-liked="0">
                  ${HEART_EMPTY}<span class="like-count">${post.like_count ?? 0}</span>
                </button>
              </div>
            </div>
          </div>
        `
      }).join('')}
    `
    attachLikeHandlers(postsEl, city)
    applyLikedState(postsEl, city)
  }

  // ── Liked tab ────────────────────────────────────────────────────────────────
  const likedEl = tabsWrap.querySelector('#tab-liked') as HTMLElement
  if (!likedList.length) {
    likedEl.innerHTML = `<p class="empty-state">${t('profile.noLikedYet')}</p>`
  } else {
    likedEl.innerHTML = `<div class="profile-posts-label" style="opacity:0.4">${t('misc.loading')}</div>`
    const likedDetails = await Promise.all(
      likedList.map((p: any) => apiFetch(`/${city}/posts/${p.issue_number}`).then(r => r.ok ? r.json() : null))
    )
    likedEl.innerHTML = `
      <div class="profile-posts-label">${tp('profile.likedIn', likedList.length, { city: cityLabel })}</div>
      ${likedList.map((p: any, i: number) => {
        const post = likedDetails[i]
        if (!post) return ''
        const authorLabel = post.author === 'anonymous' ? null : (post.author ?? null)
        const avatarEl = authorLabel ? makeAvatar(authorLabel, 36, post.avatar_url) : `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
        return `
          <div class="feed-post" role="article">
            <div class="post-left">${avatarEl}<div class="thread-line"></div></div>
            <div class="post-right">
              <div class="post-header">
                <span class="post-username">${authorLabel ? `@${escHtml(authorLabel)}` : t('misc.anonymous')}</span>
                <span class="post-time">${timeAgo(post.created_at)}</span>
              </div>
              <a href="/${city}/posts/${p.issue_number}?back=${backParam}" data-link class="post-title-feed">${escHtml(post.title)}</a>
              <div class="post-actions">
                <a href="/${city}/posts/${p.issue_number}?back=${backParam}" data-link class="post-action-btn">
                  💬 <span>${post.comments}</span>
                </a>
                <button class="post-action-btn post-like-btn" data-post="${post.number}" data-city="${city}" data-liked="1">
                  ${HEART_EMPTY}<span class="like-count">${post.like_count ?? 0}</span>
                </button>
              </div>
            </div>
          </div>
        `
      }).join('')}
    `
    attachLikeHandlers(likedEl, city)
    applyLikedState(likedEl, city)
  }
}

function attachLikeHandlers(container: HTMLElement, city: string) {
  container.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.post-like-btn')
    if (!btn) return
    const postCity = btn.dataset.city || city
    if (!isLoggedIn()) { showLoginModal(postCity); return }
    const postId = Number(btn.dataset.post!)
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    const wasLiked = btn.dataset.liked === '1'
    const inLikedTab = !!btn.closest('#tab-liked')

    btn.dataset.liked = wasLiked ? '0' : '1'
    countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? -1 : 1))
    persistLiked(postCity, postId, !wasLiked)
    const res = await apiFetch(`/${postCity}/posts/${postId}/like`, { method: 'POST' })
    if (!res.ok) {
      btn.dataset.liked = wasLiked ? '1' : '0'
      countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + (wasLiked ? 1 : -1))
      persistLiked(postCity, postId, wasLiked)
      return
    }

    if (inLikedTab && wasLiked) {
      const card = btn.closest<HTMLElement>('.feed-post')!
      card.classList.add('post-unliked')
      const overlay = document.createElement('div')
      overlay.className = 'unlike-overlay'
      overlay.innerHTML = `<span>${t('profile.removedFromLiked')}</span><button class="unlike-undo-btn">${t('profile.undo')}</button>`
      card.appendChild(overlay)
      overlay.querySelector('.unlike-undo-btn')!.addEventListener('click', async () => {
        card.classList.remove('post-unliked')
        overlay.remove()
        btn.dataset.liked = '1'
        countEl.textContent = String((parseInt(countEl.textContent ?? '0') || 0) + 1)
        persistLiked(postCity, postId, true)
        await apiFetch(`/${postCity}/posts/${postId}/like`, { method: 'POST' })
      })
    }
  })
}

function applyLikedState(container: HTMLElement, city: string) {
  if (!isLoggedIn()) return
  const liked = getLikedSet(city)
  container.querySelectorAll<HTMLButtonElement>('.post-like-btn').forEach(btn => {
    if (btn.dataset.liked === '1') return
    const postId = Number(btn.dataset.post)
    if (!liked.has(postId)) return
    btn.dataset.liked = '1'
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    if ((parseInt(countEl.textContent ?? '0') || 0) === 0) countEl.textContent = '1'
  })
}

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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
