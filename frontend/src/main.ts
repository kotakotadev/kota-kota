import { on, startRouter } from './router'
import { renderHome } from './pages/home'
import { renderCity } from './pages/city'
import { renderPost } from './pages/post'
import { renderTenants } from './pages/tenants'
import { renderLogin, renderRegister } from './pages/login'
import { renderCityPage } from './pages/city-page'

const app = document.querySelector<HTMLDivElement>('#app')!

// Global routes
on('/', () => renderHome(app))
on('/login', () => renderLogin(app))
on('/register', () => renderRegister(app))

// City routes
on('/:city', ({ city }) => renderCity(app, { city }))
on('/:city/posts/:id', ({ city, id }) => renderPost(app, { city, id }))
on('/:city/tenants', ({ city }) => renderTenants(app, { city }))

// City custom pages (served from pages/*.md in city repo)
on('/:city/about',   ({ city }) => renderCityPage(app, { city, page: 'about' }))
on('/:city/contact', ({ city }) => renderCityPage(app, { city, page: 'contact' }))
on('/:city/rules',   ({ city }) => renderCityPage(app, { city, page: 'rules' }))

// Catch-all for any extra pages city admins add via nav config
on('/:city/:page', ({ city, page }) => renderCityPage(app, { city, page }))

// Load Leaflet from CDN
const leafletScript = document.createElement('script')
leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
document.head.appendChild(leafletScript)

startRouter()
