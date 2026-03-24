import { apiFetch, isLoggedIn } from '../auth'

export async function renderTenants(el: HTMLElement, { city }: { city: string }) {
  el.innerHTML = `
    <nav class="navbar">
      <a href="/${city}" data-link>← ${city}</a>
      <span>Businesses</span>
      ${isLoggedIn() ? `<a href="/${city}/tenants/new" data-link class="btn">+ Add Business</a>` : ''}
    </nav>
    <main class="tenants-layout">
      <div id="tenant-map" class="tenant-map"></div>
      <section>
        <div class="tenant-filters">
          <select id="filter-category">
            <option value="">All categories</option>
            <option value="cafe">Cafe</option>
            <option value="restaurant">Restaurant</option>
            <option value="barbershop">Barbershop</option>
            <option value="laundry">Laundry</option>
            <option value="motor_dealer">Motor Dealer</option>
            <option value="city_council">City Council</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div id="tenant-list" class="tenant-list">
          <div class="loading">Loading businesses...</div>
        </div>
      </section>
    </main>
  `

  initTenantMap(el.querySelector('#tenant-map')!, city)
  loadTenants(el.querySelector('#tenant-list')!, city, '')

  el.querySelector('#filter-category')?.addEventListener('change', (e) => {
    const cat = (e.target as HTMLSelectElement).value
    loadTenants(el.querySelector('#tenant-list')!, city, cat)
  })
}

async function initTenantMap(container: HTMLElement, city: string) {
  const L = (window as any).L
  if (!L) return

  const map = L.map(container).setView([-7.8, 110.4], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  const res = await apiFetch(`/${city}/tenants?map=1`)
  if (!res.ok) return
  const tenants: any[] = await res.json()

  tenants.forEach(t => {
    if (!t.latitude || !t.longitude) return
    const marker = L.marker([t.latitude, t.longitude]).addTo(map)
    marker.bindPopup(`
      <strong>${escHtml(t.name)}</strong>
      ${t.is_verified ? ' ✓' : ''}<br>
      <em>${t.category}</em><br>
      <a href="/${city}/tenants/${t.slug}" data-link>View →</a>
    `)
  })
}

async function loadTenants(container: HTMLElement, city: string, category: string) {
  container.innerHTML = '<div class="loading">Loading...</div>'
  const qs = category ? `?category=${category}` : ''
  const res = await apiFetch(`/${city}/tenants${qs}`)
  if (!res.ok) { container.innerHTML = '<p class="error">Failed to load</p>'; return }
  const tenants: any[] = await res.json()

  if (!tenants.length) {
    container.innerHTML = '<p class="empty">No businesses found.</p>'
    return
  }

  container.innerHTML = tenants.map(t => `
    <a href="/${city}/tenants/${t.slug}" data-link class="tenant-card">
      ${t.avatar_url ? `<img src="${t.avatar_url}" alt="${escHtml(t.name)}" />` : '<div class="tenant-avatar-placeholder"></div>'}
      <div class="tenant-info">
        <h3>${escHtml(t.name)} ${t.is_verified ? '<span class="verified">✓</span>' : ''}</h3>
        <span class="tenant-category">${t.category}</span>
        <span class="tenant-district">${escHtml(t.district)}</span>
      </div>
    </a>
  `).join('')
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
