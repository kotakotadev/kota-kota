import type { CityConfig } from '../lib/city-config'
import { isLoggedIn } from '../auth'

export async function renderNavbar(city: string, config: CityConfig): Promise<string> {
  const loggedIn = isLoggedIn()
  const customNav = (config.nav ?? [])
    .map(item => `<a href="/${city}${item.path}" data-link>${item.label}</a>`)
    .join('')

  return `
    <nav class="navbar" style="--nav-primary: ${config.theme.primary}">
      <a href="/" data-link class="brand">city.page</a>
      ${config.theme.logo_url
        ? `<img src="${config.theme.logo_url}" alt="${config.name}" class="city-logo" />`
        : `<a href="/${city}" data-link class="city-name">${config.name}</a>`
      }
      <div class="nav-links">${customNav}</div>
      <div class="nav-actions">
        ${loggedIn
          ? `<span id="notif-bell"></span>
             <a href="/${city}/tenants" data-link>Businesses</a>
             <button id="btn-new-post" class="btn">+ Post</button>
             <button id="btn-logout">Logout</button>`
          : `<a href="/login?city=${city}" data-link>Login</a>
             <a href="/register?city=${city}" data-link class="btn">Register</a>`
        }
      </div>
    </nav>
  `
}
