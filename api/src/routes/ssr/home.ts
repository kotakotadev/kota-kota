import { Hono } from 'hono'
import { htmlShell, escHtml } from '../../lib/html'
import { withCache } from '../../lib/cache'
import type { Bindings, Variables } from '../../types'

const home = new Hono<{ Bindings: Bindings; Variables: Variables }>()

home.get('/', async (c) => {
  return withCache(c.req.raw, c.executionCtx, async () => {
    const { results: cities } = await c.env.DB.prepare(
      `SELECT slug, name, country_code, region, latitude, longitude
       FROM cities WHERE is_active = 1 ORDER BY name`
    ).all<{ slug: string; name: string; country_code: string; region: string | null; latitude: number | null; longitude: number | null }>()

    const cityRows = cities.map(city => `
      <a class="city-result-row" href="/${escHtml(city.slug)}" data-link>
        <div>
          <div class="city-result-name">${escHtml(city.name)}</div>
          <div class="city-result-meta">${escHtml(city.region ?? '')} · ${escHtml(city.country_code)}</div>
        </div>
        <span class="city-result-arrow">→</span>
      </a>`
    ).join('')

    const content = `
      <header class="top-bar">
        <div class="top-bar-left">
          <span class="brand-name">${escHtml(c.env.APP_NAME)}</span>
        </div>
        <div class="top-bar-right" id="auth-area">
          <a href="/login" data-link class="top-bar-link">Login</a>
          <a href="/register" data-link class="top-bar-btn">Join</a>
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
          <div id="city-results">${cityRows}</div>
        </div>
        <div class="home-map" id="city-map"></div>
      </div>`

    return c.html(htmlShell({
      title: c.env.APP_NAME,
      description: 'Community platform for local residents — post, discuss, discover.',
      content,
      appUrl: c.env.APP_URL,
      appName: c.env.APP_NAME,
      ssrPage: 'home',
      ssrInlineData: { page: 'home', cities }
    }))
  }, 300)
})

export default home
