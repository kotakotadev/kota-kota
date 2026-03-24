import { apiFetch, isLoggedIn } from '../auth'
import { navigate } from '../router'
import { APP_NAME } from '../config'

export async function renderHome(el: HTMLElement) {
  el.innerHTML = `
    <header class="top-bar">
      <div class="top-bar-left">
        <span class="brand-name">${APP_NAME}</span>
      </div>
      <div class="top-bar-right">
        ${isLoggedIn()
          ? `<button id="home-logout" class="top-bar-link">Logout</button>`
          : `<a href="/login" data-link class="top-bar-link">Login</a>
             <a href="/register" data-link class="top-bar-btn">Join</a>`
        }
      </div>
    </header>
    <div class="home-wrap">
      <div class="home-hero">
        <h1>Your city,<br>your voice.</h1>
        <p>A community platform for local residents — post, discuss, discover.</p>
      </div>
      <div class="home-search-wrap">
        <div class="search-bar">
          <span class="search-icon">⊕</span>
          <input class="search-field" id="city-input" type="text" placeholder="Search a city…" autocomplete="off" />
        </div>
        <div id="city-results"></div>
      </div>
      <div class="home-map" id="city-map"></div>
    </div>
  `

  el.querySelector('#home-logout')?.addEventListener('click', () => {
    import('../auth').then(m => m.logout())
  })
  initCityMap(el.querySelector('#city-map')!)
  initCitySearch(
    el.querySelector<HTMLInputElement>('#city-input')!,
    el.querySelector('#city-results')!
  )
}

async function initCityMap(container: HTMLElement) {
  const L = (window as any).L
  if (!L) return

  const map = L.map(container).setView([0, 120], 3)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  const res = await apiFetch('/cities')
  if (!res.ok) return
  const cities: any[] = await res.json()

  cities.forEach(city => {
    if (!city.latitude || !city.longitude) return
    L.marker([city.latitude, city.longitude])
      .addTo(map)
      .bindPopup(`<strong>${city.name}</strong><br><a href="/${city.slug}" data-link>Open →</a>`)
  })
}

function initCitySearch(input: HTMLInputElement, results: HTMLElement) {
  let timeout: ReturnType<typeof setTimeout>
  input.addEventListener('input', () => {
    clearTimeout(timeout)
    timeout = setTimeout(async () => {
      const q = input.value.trim()
      if (q.length < 2) { results.innerHTML = ''; return }
      const res = await apiFetch('/cities')
      const cities: any[] = res.ok ? await res.json() : []
      const filtered = cities.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.slug.includes(q.toLowerCase())
      )
      results.innerHTML = filtered.map(c =>
        `<a class="city-result-row" href="/${c.slug}" data-link>
          <div>
            <div class="city-result-name">${c.name}</div>
            <div class="city-result-meta">${c.region ?? ''} · ${c.country_code}</div>
          </div>
          <span class="city-result-arrow">→</span>
        </a>`
      ).join('') || `<div class="city-result-row"><span class="city-result-meta">No cities found</span></div>`
    }, 300)
  })
}
