import type { CityConfig } from '../lib/city-config'
import { isLoggedIn } from '../auth'
import { APP_NAME } from '../config'

function avatarColor(name: string): string {
  const palette = ['#FF6B6B','#4ECDC4','#45B7D1','#F4A261','#A78BFA','#34D399','#FB923C']
  return palette[name.charCodeAt(0) % palette.length]
}

function makeAvatar(name: string, size = 36): string {
  const initials = name.slice(0, 2).toUpperCase()
  const bg = avatarColor(name)
  return `<div class="avatar" style="background:${bg};width:${size}px;height:${size}px">${initials}</div>`
}

function bottomNav(city: string, loggedIn: boolean): string {
  return `
    <nav class="bottom-nav">
      <a href="/${city}" data-link class="bottom-nav-item active">
        <span class="nav-icon">⌂</span>
        <span>Home</span>
      </a>
      <a href="/" data-link class="bottom-nav-item">
        <span class="nav-icon">◎</span>
        <span>Cities</span>
      </a>
      ${loggedIn
        ? `<button class="bottom-nav-item bottom-nav-compose" id="bottom-compose" title="New post">✎</button>`
        : `<a href="/login?city=${city}" data-link class="bottom-nav-item bottom-nav-compose" title="Post">✎</a>`
      }
      <a href="/${city}/tenants" data-link class="bottom-nav-item">
        <span class="nav-icon">⊞</span>
        <span>Places</span>
      </a>
      ${loggedIn
        ? `<button id="btn-logout-mobile" class="bottom-nav-item">
             <span class="nav-icon">↩</span>
             <span>Logout</span>
           </button>`
        : `<a href="/login?city=${city}" data-link class="bottom-nav-item">
             <span class="nav-icon">👤</span>
             <span>Login</span>
           </a>`
      }
    </nav>
  `
}

export async function renderNavbar(city: string, config: CityConfig): Promise<string> {
  const loggedIn = isLoggedIn()

  return `
    <header class="top-bar">
      <div class="top-bar-left">
        <a href="/" data-link class="brand-name">${APP_NAME}</a>
        <a href="/${city}" data-link class="city-badge">${config.name || city}</a>
      </div>
      <div class="top-bar-right">
        <a href="/${city}/tenants" data-link class="top-bar-link top-bar-desktop-only">Places</a>
        ${loggedIn
          ? `<span id="notif-bell" class="notif-wrap"></span>
             <button id="btn-new-post" class="top-bar-btn">Post</button>
             <button id="btn-logout" class="top-bar-link">Logout</button>`
          : `<a href="/login?city=${city}" data-link class="top-bar-link">Login</a>
             <a href="/register?city=${city}" data-link class="top-bar-btn">Join</a>`
        }
      </div>
    </header>
    ${bottomNav(city, loggedIn)}
  `
}

export { makeAvatar, avatarColor }
