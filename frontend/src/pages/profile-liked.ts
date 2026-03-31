import { apiFetch, isLoggedIn, logout } from '../auth'
import { navigate } from '../router'
import { makeAvatar, renderNavbar, initNavbarEvents } from '../components/navbar'
import { getCityConfig } from '../lib/city-config'
import { renderNotificationBell } from '../components/notifications'
import { showLoginModal } from '../lib/login-modal'
import { t, tp } from '../lib/i18n'

const BACK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`
const HEART_EMPTY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`

export async function renderProfileLiked(el: HTMLElement) {
  const city = new URLSearchParams(location.search).get('city') ?? localStorage.getItem('citypage_city') ?? ''
  const back = `/profile${city ? `?city=${city}` : ''}`

  if (!isLoggedIn()) { navigate('/login'); return }

  if (city) {
    const config = await getCityConfig(city)
    document.documentElement.style.setProperty('--primary', config.theme.primary)
    el.innerHTML = `
      ${await renderNavbar(city, config)}
      <div class="post-detail-wrap">
        <a href="${back}" data-link class="post-detail-back">${t('btn.back')}</a>
        <div class="feed-wrap" id="liked-content"><div class="loading">${t('misc.loading')}</div></div>
      </div>
    `
    initNavbarEvents(el)
    el.querySelector('#btn-logout')?.addEventListener('click', () => logout())
    el.querySelector('#btn-logout-mobile')?.addEventListener('click', () => logout())
    const notifEl = el.querySelector<HTMLElement>('#notif-bell')
    const notifElMobile = el.querySelector<HTMLElement>('#notif-bell-mobile')
    if (notifEl) renderNotificationBell(notifEl, city)
    if (notifElMobile) renderNotificationBell(notifElMobile, city)
  } else {
    el.innerHTML = `
      <div class="top-bar">
        <div class="top-bar-left">
          <a href="${back}" data-link class="top-bar-back">${BACK_SVG}</a>
        </div>
        <div class="top-bar-center"><span class="top-bar-title">${t('profile.likedPosts')}</span></div>
        <div class="top-bar-right"></div>
      </div>
      <div class="feed-wrap" id="liked-content" style="margin-top:3.5rem">
        <div class="loading">${t('misc.loading')}</div>
      </div>
    `
  }

  const likedRes = await apiFetch('/users/me/liked')
  const content = el.querySelector('#liked-content')!
  const likedList: any[] = likedRes.ok ? await likedRes.json() : []

  if (!likedList.length) {
    content.innerHTML = `<p class="empty-state">${t('profile.noLikedYet')}</p>`
    return
  }

  const details = await Promise.all(
    likedList.map(p => apiFetch(`/${p.city_slug}/posts/${p.issue_number}`).then(r => r.ok ? r.json() : null))
  )

  const backParam = encodeURIComponent(location.pathname + location.search)

  content.innerHTML = details.map((post, i) => {
    if (!post) return ''
    const p = likedList[i]
    const authorLabel = post.author === 'anonymous' ? null : (post.author ?? null)
    const avatarEl = authorLabel
      ? makeAvatar(authorLabel, 36, post.avatar_url)
      : `<div class="avatar anon" style="width:36px;height:36px">🕵️</div>`
    return `
      <div class="feed-post" role="article">
        <div class="post-left">${avatarEl}<div class="thread-line"></div></div>
        <div class="post-right">
          <div class="post-header">
            <span class="post-username">${authorLabel ? `@${escHtml(authorLabel)}` : t('misc.anonymous')}</span>
            <span class="post-category-pill">${escHtml(p.city_name || p.city_slug)}</span>
            <span class="post-time">${timeAgo(post.created_at)}</span>
          </div>
          <a href="/${p.city_slug}/posts/${p.issue_number}?back=${backParam}" data-link class="post-title-feed">${escHtml(post.title)}</a>
          <div class="post-actions">
            <a href="/${p.city_slug}/posts/${p.issue_number}?back=${backParam}" data-link class="post-action-btn">
              💬 <span>${tp('post.reply', post.comments)}</span>
            </a>
            <button class="post-action-btn post-like-btn" data-post="${post.number}" data-city="${p.city_slug}" data-liked="1">
              ${HEART_EMPTY}<span class="like-count">${post.like_count ?? 0}</span>
            </button>
          </div>
        </div>
      </div>
    `
  }).join('')

  attachLikeHandlers(content as HTMLElement, city)
}

function attachLikeHandlers(container: HTMLElement, defaultCity: string) {
  container.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.post-like-btn')
    if (!btn) return
    const postCity = btn.dataset.city || defaultCity
    if (!isLoggedIn()) { showLoginModal(postCity); return }
    const postId = Number(btn.dataset.post!)
    const countEl = btn.querySelector<HTMLElement>('.like-count')!
    const wasLiked = btn.dataset.liked === '1'
    const card = btn.closest<HTMLElement>('.feed-post')!

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

    // Liked tab: show undo when unliking
    if (wasLiked) {
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

function getLikedSet(city: string): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(`citypage_likes_${city}`) ?? '[]')) }
  catch { return new Set() }
}
function persistLiked(city: string, id: number, liked: boolean) {
  const set = getLikedSet(city)
  liked ? set.add(id) : set.delete(id)
  localStorage.setItem(`citypage_likes_${city}`, JSON.stringify([...set]))
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
