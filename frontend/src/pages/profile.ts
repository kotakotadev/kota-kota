import { apiFetch, getToken, isLoggedIn, logout, storeProfile } from '../auth'
import { navigate } from '../router'
import { avatarColor, renderNavbar, initNavbarEvents } from '../components/navbar'
import { getCityConfig } from '../lib/city-config'
import { renderNotificationBell } from '../components/notifications'
import { APP_NAME } from '../config'
import { t } from '../lib/i18n'
import { apiUrl } from '../config'

const CAMERA_SVG  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
const POSTS_SVG   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
const HEART_SVG   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
const COMMENT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
const SETTINGS_SVG= `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
const LOGOUT_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`

export async function renderProfile(el: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const city = params.get('city') ?? localStorage.getItem('citypage_city') ?? ''

  if (!isLoggedIn()) {
    navigate(city ? `/login?city=${city}` : '/login')
    return
  }

  const cityQ = city ? `?city=${city}` : ''

  if (city) {
    const config = await getCityConfig(city)
    document.documentElement.style.setProperty('--primary', config.theme.primary)
    el.innerHTML = `
      ${await renderNavbar(city, config)}
      <div class="post-detail-wrap">
        <a href="/${city}" data-link class="post-detail-back">${t('btn.back')}</a>
        <div id="profile-hub-content"><div class="loading">${t('misc.loading')}</div></div>
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
  } else {
    el.innerHTML = `
      <div class="top-bar">
        <div class="top-bar-left">
          <a href="/" data-link class="brand-logo-btn">
            <img src="/logo.svg" alt="${APP_NAME}" class="brand-logo-img">
            <span class="brand-wordmark">${APP_NAME}</span>
          </a>
        </div>
        <div class="top-bar-right"></div>
      </div>
      <div class="profile-hub-wrap" style="margin-top:3.5rem">
        <div id="profile-hub-content"><div class="loading">${t('misc.loading')}</div></div>
      </div>
    `
  }

  const meRes = await apiFetch('/users/me')
  if (!meRes.ok) {
    el.querySelector('#profile-hub-content')!.innerHTML = `<p class="empty-state">${t('profile.failedToLoad')}</p>`
    return
  }

  const user: any = await meRes.json()
  const joined = new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  const bg = avatarColor(user.username)
  const initials = user.username.slice(0, 2).toUpperCase()

  const avatarInner = user.avatar_url
    ? `<img src="${escHtml(user.avatar_url)}" class="profile-hub-avatar-img" alt="${escHtml(user.username)}">`
    : `<div class="profile-hub-avatar-initials" style="background:${bg}">${initials}</div>`

  el.querySelector('#profile-hub-content')!.innerHTML = `
    <div class="profile-hub-header">
      <div class="profile-hub-avatar-wrap" id="avatar-wrap">
        ${avatarInner}
        <label class="profile-hub-avatar-edit" title="${t('profile.editAvatar')}">
          ${CAMERA_SVG}
          <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none">
        </label>
      </div>
      <div id="avatar-status" class="avatar-upload-status hidden"></div>
      <div class="profile-hub-name">
        @${escHtml(user.username)}
        ${user.is_verified ? `<span class="profile-verified">✓</span>` : ''}
      </div>
      <div class="profile-hub-meta">${t('profile.joined', { date: joined })}</div>
    </div>

    <div class="profile-menu">
      <a href="/profile/posts${cityQ}" data-link class="profile-menu-item">
        <span class="profile-menu-icon">${POSTS_SVG}</span>
        <span class="profile-menu-label">${t('profile.myPosts')}</span>
        <span class="profile-menu-chevron">›</span>
      </a>
      <a href="/profile/liked${cityQ}" data-link class="profile-menu-item">
        <span class="profile-menu-icon">${HEART_SVG}</span>
        <span class="profile-menu-label">${t('profile.likedPosts')}</span>
        <span class="profile-menu-chevron">›</span>
      </a>
      <a href="/profile/comments${cityQ}" data-link class="profile-menu-item">
        <span class="profile-menu-icon">${COMMENT_SVG}</span>
        <span class="profile-menu-label">${t('profile.myComments')}</span>
        <span class="profile-menu-chevron">›</span>
      </a>
    </div>

    <div class="profile-menu">
      <a href="/profile/settings" data-link class="profile-menu-item">
        <span class="profile-menu-icon">${SETTINGS_SVG}</span>
        <span class="profile-menu-label">${t('profile.settings')}</span>
        <span class="profile-menu-chevron">›</span>
      </a>
      <button class="profile-menu-item danger" id="hub-logout">
        <span class="profile-menu-icon">${LOGOUT_SVG}</span>
        <span class="profile-menu-label">${t('btn.logout')}</span>
      </button>
    </div>
  `

  el.querySelector('#hub-logout')?.addEventListener('click', () => logout())

  // ── Avatar upload ────────────────────────────────────────────────────────────
  const avatarInput = el.querySelector<HTMLInputElement>('#avatar-input')!
  const avatarStatus = el.querySelector<HTMLElement>('#avatar-status')!
  const avatarWrap = el.querySelector<HTMLElement>('#avatar-wrap')!

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files?.[0]
    if (!file) return

    avatarWrap.classList.add('profile-hub-avatar-uploading')
    avatarStatus.textContent = t('profile.uploadingAvatar')
    avatarStatus.classList.remove('hidden')

    let blob: Blob
    try {
      blob = await resizeAvatar(file, 256, 0.82)
    } catch {
      blob = file
    }

    const form = new FormData()
    form.append('avatar', blob, 'avatar.jpg')
    // Use raw fetch — apiFetch injects Content-Type: application/json which breaks multipart
    const token = getToken()
    const res = await fetch(apiUrl('/users/me/avatar'), {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    avatarWrap.classList.remove('profile-hub-avatar-uploading')

    if (!res.ok) {
      avatarStatus.textContent = t('profile.avatarFailed')
      return
    }

    const { url } = await res.json()
    const prev = avatarWrap.querySelector<HTMLElement>('.profile-hub-avatar-img, .profile-hub-avatar-initials')
    if (prev) {
      const img = document.createElement('img')
      img.src = url
      img.className = 'profile-hub-avatar-img'
      img.alt = user.username
      prev.replaceWith(img)
    }

    storeProfile(user.username, url)
    avatarStatus.textContent = t('profile.avatarUpdated')
    setTimeout(() => avatarStatus.classList.add('hidden'), 2500)
  })
}

/** Crop to square, resize to maxPx × maxPx, encode as JPEG at given quality. */
function resizeAvatar(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const size = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth  - size) / 2
      const sy = (img.naturalHeight - size) / 2
      const canvas = document.createElement('canvas')
      canvas.width  = maxPx
      canvas.height = maxPx
      canvas.getContext('2d')!.drawImage(img, sx, sy, size, size, 0, 0, maxPx, maxPx)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('toBlob failed')),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('load failed')) }
    img.src = objectUrl
  })
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
