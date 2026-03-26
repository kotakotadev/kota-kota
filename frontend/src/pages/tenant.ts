import { apiFetch, isLoggedIn } from '../auth'
import { getCityConfig } from '../lib/city-config'
import { renderNavbar, makeAvatar } from '../components/navbar'

export async function renderTenant(el: HTMLElement, { city, slug }: { city: string; slug: string }) {
  const config = await getCityConfig(city)
  document.documentElement.style.setProperty('--primary', config.theme.primary)

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <div class="post-detail-wrap">
      <a href="/${city}/tenants" data-link class="post-detail-back">← Places</a>
      <div id="tenant-content"><div class="loading">Loading…</div></div>
    </div>
  `

  if (isLoggedIn()) {
    const doLogout = () => import('../auth').then(m => m.logout())
    el.querySelector('#btn-logout')?.addEventListener('click', doLogout)
    el.querySelector('#btn-logout-mobile')?.addEventListener('click', doLogout)
  }

  const res = await apiFetch(`/${city}/tenants/${slug}`)
  if (!res.ok) {
    el.querySelector('#tenant-content')!.innerHTML = '<p class="empty-state">Place not found.</p>'
    return
  }

  const t = await res.json() as any

  el.querySelector('#tenant-content')!.innerHTML = `
    <div class="post-detail-main">
      <div class="post-left" style="align-items:flex-start;padding-top:0.25rem">
        ${t.avatar_url
          ? `<img src="${escHtml(t.avatar_url)}" alt="${escHtml(t.name)}" class="avatar" style="width:48px;height:48px;object-fit:cover;border-radius:50%">`
          : makeAvatar(t.name, 48)
        }
      </div>
      <div class="post-detail-content">
        <div class="post-header">
          <span class="post-username">${escHtml(t.name)}${t.is_verified ? ' <span style="color:var(--primary)">✓ Verified</span>' : ''}</span>
        </div>
        <span class="post-category-pill">${escHtml(t.category)}</span>
        ${t.description ? `<p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.9375rem">${escHtml(t.description)}</p>` : ''}
        <div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.375rem;font-size:0.875rem;color:var(--text-muted)">
          ${t.address ? `<div>📍 ${escHtml(t.address)}${t.district ? ` · ${escHtml(t.district)}` : ''}</div>` : ''}
          ${t.google_maps_url ? `<div><a href="${escHtml(t.google_maps_url)}" target="_blank" rel="noopener" style="color:var(--primary)">View on Google Maps →</a></div>` : ''}
        </div>
        ${(t.members ?? []).length > 0 ? `
          <div style="margin-top:1rem">
            <div class="comments-label">Team</div>
            ${t.members.map((m: any) => `
              <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--separator)">
                ${makeAvatar(m.username, 28)}
                <span style="font-size:0.875rem">@${escHtml(m.username)}</span>
                <span class="post-category-pill" style="font-size:0.6875rem">${escHtml(m.role)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
