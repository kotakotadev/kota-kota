import { on, startRouter } from './router'
import { isLoggedIn, apiFetch, storeProfile, resolveProfileNull } from './auth'
import { renderHome } from './pages/home'
import { renderCity } from './pages/city'
import { renderPost } from './pages/post'
import { renderTenant } from './pages/tenant'
import { renderLogin, renderRegister } from './pages/login'
import { renderProfile } from './pages/profile'
import { renderProfilePosts } from './pages/profile-posts'
import { renderProfileLiked } from './pages/profile-liked'
import { renderProfileComments } from './pages/profile-comments'
import { renderProfileSettings } from './pages/profile-settings'
import { renderCityPage } from './pages/city-page'
import { renderCityUser } from './pages/city-user'
import { renderNewPost } from './pages/new-post'
import { renderSearch } from './pages/search'
import { initViewTracker } from './lib/view-tracker'
import { initI18n } from './lib/i18n'
import './lib/pwa'

const app = document.querySelector<HTMLDivElement>('#app')!

await initI18n()

// Cache user profile for avatars in compose/comment bars
if (isLoggedIn()) {
  apiFetch('/users/me').then(r => r.ok ? r.json() : null).then(u => {
    if (u) storeProfile(u.username, u.avatar_url ?? null)
    else resolveProfileNull()
  })
} else {
  resolveProfileNull()
}

// Global routes
on('/', () => renderHome(app))
on('/login', () => renderLogin(app))
on('/register', () => renderRegister(app))
on('/profile', () => renderProfile(app))
on('/profile/posts', () => renderProfilePosts(app))
on('/profile/liked', () => renderProfileLiked(app))
on('/profile/comments', () => renderProfileComments(app))
on('/profile/settings', () => renderProfileSettings(app))

// City routes
on('/:city', ({ city }) => renderCity(app, { city }))
on('/:city/posts/:id', ({ city, id }) => renderPost(app, { city, id }))
on('/:city/trending', ({ city }) => renderCity(app, { city, tab: 'trending' }))
on('/:city/places/:slug', ({ city, slug }) => renderTenant(app, { city, slug }))

// City custom pages (served from pages/*.md in city repo)
on('/:city/about',   ({ city }) => renderCityPage(app, { city, page: 'about' }))
on('/:city/contact', ({ city }) => renderCityPage(app, { city, page: 'contact' }))
on('/:city/rules',   ({ city }) => renderCityPage(app, { city, page: 'rules' }))

// New post
on('/:city/new', ({ city }) => renderNewPost(app, { city }))
// Search
on('/:city/search', ({ city }) => renderSearch(app, { city }))

// Public user profile within a city
on('/:city/@:username', ({ city, username }) => renderCityUser(app, { city, username }))

// Catch-all for any extra pages city admins add via nav config
on('/:city/:page', ({ city, page }) => renderCityPage(app, { city, page }))

// Load Leaflet from CDN
const leafletScript = document.createElement('script')
leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
document.head.appendChild(leafletScript)

startRouter()
initViewTracker()
