import { apiFetch, isLoggedIn } from '../auth'
import { APP_NAME } from '../config'

function consumeSSR(): any | null {
  const raw = (window as any).__SSR__
  if (!raw || raw.page !== 'home') return null
  delete (window as any).__SSR__
  return raw
}

export async function renderHome(el: HTMLElement) {
  const ssr = consumeSSR()

  if (!ssr) {
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
  } else {
    // SSR page: update auth area
    const authArea = el.querySelector<HTMLElement>('#auth-area')
    if (authArea) {
      authArea.innerHTML = isLoggedIn()
        ? `<button id="home-logout" class="top-bar-link">Logout</button>`
        : `<a href="/login" data-link class="top-bar-link">Login</a>
           <a href="/register" data-link class="top-bar-btn">Join</a>`
    }
    // Hide city list (search input will show filtered results)
    const resultsEl = el.querySelector<HTMLElement>('#city-results')
    if (resultsEl) resultsEl.innerHTML = ''
  }

  el.querySelector('#home-logout')?.addEventListener('click', () => {
    import('../auth').then(m => m.logout())
  })

  const cities: any[] = ssr?.cities ?? []
  initCityMap(el.querySelector('#city-map')!, cities)
  initCitySearch(
    el.querySelector<HTMLInputElement>('#city-input')!,
    el.querySelector('#city-results')!,
    cities
  )
}

async function initCityMap(container: HTMLElement, preloaded: any[]) {
  const L = (window as any).L
  if (!L) return

  const map = L.map(container).setView([0, 120], 3)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  let cities = preloaded
  if (!cities.length) {
    const res = await apiFetch('/cities')
    if (!res.ok) return
    cities = await res.json()
  }

  cities.forEach(city => {
    if (!city.latitude || !city.longitude) return
    L.marker([city.latitude, city.longitude])
      .addTo(map)
      .bindPopup(`<strong>${city.name}</strong><br><a href="/${city.slug}" data-link>Open →</a>`)
  })
}

function initCitySearch(input: HTMLInputElement, results: HTMLElement, preloaded: any[]) {
  if (!input) return
  let timeout: ReturnType<typeof setTimeout>
  let allCities = preloaded

  input.addEventListener('input', () => {
    clearTimeout(timeout)
    timeout = setTimeout(async () => {
      const q = input.value.trim()
      if (q.length < 2) { results.innerHTML = ''; return }

      if (!allCities.length) {
        const res = await apiFetch('/cities')
        allCities = res.ok ? await res.json() : []
      }

      const filtered = allCities.filter(c =>
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
