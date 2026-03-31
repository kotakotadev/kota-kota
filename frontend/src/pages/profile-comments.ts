import { apiFetch, isLoggedIn, logout } from '../auth'
import { navigate } from '../router'
import { makeAvatar, renderNavbar, initNavbarEvents } from '../components/navbar'
import { getCityConfig } from '../lib/city-config'
import { renderNotificationBell } from '../components/notifications'
import { t } from '../lib/i18n'

const BACK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`

export async function renderProfileComments(el: HTMLElement) {
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
        <div class="feed-wrap" id="comments-content"><div class="loading">${t('misc.loading')}</div></div>
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
        <div class="top-bar-center"><span class="top-bar-title">${t('profile.myComments')}</span></div>
        <div class="top-bar-right"></div>
      </div>
      <div class="feed-wrap" id="comments-content" style="margin-top:3.5rem">
        <div class="loading">${t('misc.loading')}</div>
      </div>
    `
  }

  const [meRes, commentsRes] = await Promise.all([
    apiFetch('/users/me'),
    apiFetch('/users/me/comments')
  ])

  const content = el.querySelector('#comments-content')!

  if (!meRes.ok) {
    content.innerHTML = `<p class="empty-state">${t('profile.failedToLoad')}</p>`
    return
  }

  const user: any = await meRes.json()
  const commentList: any[] = commentsRes.ok ? await commentsRes.json() : []

  if (!commentList.length) {
    content.innerHTML = `<p class="empty-state">${t('profile.noCommentsYet')}</p>`
    return
  }

  const backParam = encodeURIComponent(location.pathname + location.search)

  content.innerHTML = commentList.map(c => {
    const postHref = `/${c.city_slug}/posts/${c.issue_number}?back=${backParam}`
    const timeStr = timeAgo(new Date(c.created_at).toISOString())
    const preview = c.body.length > 180 ? c.body.slice(0, 180) + '…' : c.body
    return `
      <div class="feed-post" role="article">
        <div class="post-left">${makeAvatar(user.username, 36, user.avatar_url)}<div class="thread-line"></div></div>
        <div class="post-right">
          <div class="post-header">
            <span class="post-username">@${escHtml(user.username)}</span>
            <span class="post-category-pill">${escHtml(c.city_name || c.city_slug)}</span>
            <span class="post-time">${timeStr}</span>
          </div>
          <p class="comment-preview-text">${escHtml(preview)}</p>
          <a href="${postHref}" data-link class="post-action-btn comment-view-post-link">
            💬 ${t('profile.viewPost')} →
          </a>
        </div>
      </div>
    `
  }).join('')
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
