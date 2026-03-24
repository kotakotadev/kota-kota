import { apiFetch } from '../auth'
import { navigate } from '../router'

export async function renderHome(el: HTMLElement) {
  el.innerHTML = `
    <div class="home">
      <header class="hero">
        <h1>city.page</h1>
        <p>Your local community — post, comment, discover businesses near you.</p>
      </header>
      <section class="city-search">
        <input id="city-input" type="text" placeholder="Search your city..." autocomplete="off" />
        <div id="city-results"></div>
      </section>
      <section id="city-map" class="city-map"></section>
    </div>
  `

  await initCityMap(el.querySelector('#city-map')!)
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
        `<a class="city-result" href="/${c.slug}" data-link>
          <strong>${c.name}</strong>
          <span>${c.region ?? ''} · ${c.country_code}</span>
        </a>`
      ).join('') || '<p class="no-results">No cities found</p>'
    }, 300)
  })
}
