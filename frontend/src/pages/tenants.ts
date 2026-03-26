import { apiFetch, isLoggedIn } from '../auth'
import { getCityConfig } from '../lib/city-config'
import { renderNavbar, makeAvatar } from '../components/navbar'

export async function renderTenants(el: HTMLElement, { city }: { city: string }) {
  const config = await getCityConfig(city)
  document.documentElement.style.setProperty('--primary', config.theme.primary)

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <div class="feed-container">
      <div class="feed-filters" id="tenant-filters">
        <button class="filter-pill active" data-cat="">All</button>
        <button class="filter-pill" data-cat="cafe">Cafe</button>
        <button class="filter-pill" data-cat="restaurant">Restaurant</button>
        <button class="filter-pill" data-cat="barbershop">Barbershop</button>
        <button class="filter-pill" data-cat="laundry">Laundry</button>
        <button class="filter-pill" data-cat="motor_dealer">Motor Dealer</button>
        <button class="filter-pill" data-cat="city_council">City Council</button>
        <button class="filter-pill" data-cat="other">Other</button>
      </div>
      <div id="tenant-map" class="home-map" style="margin-bottom:0.5rem"></div>
      <div id="tenant-list"></div>
    </div>
    <div id="post-modal" class="modal hidden"></div>
  `

  if (isLoggedIn()) {
    const doLogout = () => import('../auth').then(m => m.logout())
    el.querySelector('#btn-logout')?.addEventListener('click', doLogout)
    el.querySelector('#btn-logout-mobile')?.addEventListener('click', doLogout)
    el.querySelector('#btn-new-post')?.addEventListener('click', () => showAddBusinessModal(el.querySelector('#post-modal')!, city, config.districts))
    el.querySelector('#bottom-compose')?.addEventListener('click', () => showAddBusinessModal(el.querySelector('#post-modal')!, city, config.districts))
  }

  el.querySelector('#tenant-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-pill')
    if (!btn) return
    el.querySelectorAll('#tenant-filters .filter-pill').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    loadTenants(el.querySelector('#tenant-list')!, city, btn.dataset.cat ?? '')
  })

  initTenantMap(el.querySelector('#tenant-map')!, city)
  loadTenants(el.querySelector('#tenant-list')!, city, '')
}

async function initTenantMap(container: HTMLElement, city: string) {
  const L = (window as any).L
  if (!L) { container.style.display = 'none'; return }

  const map = L.map(container).setView([-7.8, 110.4], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  const res = await apiFetch(`/${city}/tenants?map=1`)
  if (!res.ok) return
  const tenants: any[] = await res.json()

  tenants.forEach(t => {
    if (!t.latitude || !t.longitude) return
    L.marker([t.latitude, t.longitude]).addTo(map)
      .bindPopup(`<strong>${escHtml(t.name)}</strong>${t.is_verified ? ' ✓' : ''}<br><em>${t.category}</em><br><a href="/${city}/tenants/${t.slug}" data-link>View →</a>`)
  })
}

async function loadTenants(container: HTMLElement, city: string, category: string) {
  container.innerHTML = '<div class="loading">Loading…</div>'
  const qs = category ? `?category=${encodeURIComponent(category)}` : ''
  const res = await apiFetch(`/${city}/tenants${qs}`)
  if (!res.ok) { container.innerHTML = '<p class="empty-state">Failed to load places.</p>'; return }
  const tenants: any[] = await res.json()

  if (!tenants.length) {
    container.innerHTML = '<p class="empty-state">No places listed yet — add the first one!</p>'
    return
  }

  container.innerHTML = tenants.map(t => `
    <a href="/${city}/tenants/${t.slug}" data-link class="feed-post" style="text-decoration:none">
      <div class="post-left">
        ${t.avatar_url
          ? `<img src="${escHtml(t.avatar_url)}" alt="${escHtml(t.name)}" class="avatar" style="width:36px;height:36px;object-fit:cover;border-radius:50%">`
          : makeAvatar(t.name)
        }
        <div class="thread-line"></div>
      </div>
      <div class="post-right">
        <div class="post-header">
          <span class="post-username">${escHtml(t.name)}${t.is_verified ? ' <span style="color:var(--primary)">✓</span>' : ''}</span>
          <span class="post-category-pill">${escHtml(t.category)}</span>
        </div>
        <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:0.125rem">${escHtml(t.address ?? '')}${t.district ? ` · ${escHtml(t.district)}` : ''}</div>
      </div>
    </a>
  `).join('')
}

function showAddBusinessModal(modal: HTMLElement, city: string, districts: string[]) {
  modal.classList.remove('hidden')
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">Add a Place</div>
      <form id="add-business-form" style="display:flex;flex-direction:column;gap:0.75rem">
        <input class="modal-input" name="name" placeholder="Business name" required />
        <input class="modal-input" name="slug" placeholder="URL slug (e.g. warung-bu-siti)" required />
        <select class="modal-input modal-select" name="category" required>
          <option value="">Category</option>
          <option value="cafe">Cafe</option>
          <option value="restaurant">Restaurant</option>
          <option value="barbershop">Barbershop</option>
          <option value="laundry">Laundry</option>
          <option value="motor_dealer">Motor Dealer</option>
          <option value="city_council">City Council</option>
          <option value="other">Other</option>
        </select>
        <input class="modal-input" name="address" placeholder="Address" required />
        <select class="modal-input modal-select" name="district" required>
          <option value="">District</option>
          ${districts.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('')}
        </select>
        <input class="modal-input" name="google_maps_url" placeholder="Google Maps URL (optional)" type="url" />
        <p id="business-error" class="error-msg hidden"></p>
        <div class="modal-footer">
          <button type="button" class="modal-cancel" id="cancel-business">Cancel</button>
          <button type="submit" class="modal-publish">Add Place</button>
        </div>
      </form>
    </div>
  `

  modal.querySelector('#cancel-business')?.addEventListener('click', () => modal.classList.add('hidden'))
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden') })

  modal.querySelector('#add-business-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = Object.fromEntries(new FormData(form))
    const errEl = modal.querySelector<HTMLElement>('#business-error')!
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!
    btn.textContent = 'Adding…'; btn.disabled = true

    const res = await apiFetch(`/${city}/tenants`, { method: 'POST', body: JSON.stringify(data) })
    if (!res.ok) {
      errEl.textContent = (await res.json()).error ?? 'Failed to add place'
      errEl.classList.remove('hidden')
      btn.textContent = 'Add Place'; btn.disabled = false
      return
    }
    const { slug } = await res.json()
    modal.classList.add('hidden')
    import('../router').then(m => m.navigate(`/${city}/tenants/${slug}`))
  })
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
