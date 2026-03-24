import { login, register } from '../auth'
import { navigate } from '../router'
import { APP_NAME } from '../config'

export function renderLogin(el: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const citySlug = params.get('city') ?? ''

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-logo">${APP_NAME}</div>
      <div class="auth-card">
        <h2>Welcome back</h2>
        <p>Sign in to your community account.</p>
        <form class="auth-form" id="login-form">
          <input class="auth-field" name="email" type="email" placeholder="Email" required autocomplete="email" />
          <input class="auth-field" name="password" type="password" placeholder="Password" required autocomplete="current-password" />
          ${citySlug
            ? `<input type="hidden" name="city" value="${citySlug}" />`
            : `<input class="auth-field" name="city" type="text" placeholder="City slug (e.g. yogyakarta-id)" required />`
          }
          <p id="login-error" class="error-msg hidden"></p>
          <button class="auth-submit" type="submit">Sign in</button>
        </form>
        <p class="auth-footer">No account? <a href="/register?city=${citySlug}" data-link>Create one</a></p>
      </div>
    </div>
  `

  el.querySelector('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const city = (form.elements.namedItem('city') as HTMLInputElement).value
    const errEl = form.querySelector<HTMLElement>('#login-error')!
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!
    btn.textContent = 'Signing in…'
    btn.disabled = true
    try {
      await login(email, password, city)
      navigate(city ? `/${city}` : '/')
    } catch (err: any) {
      errEl.textContent = err.message
      errEl.classList.remove('hidden')
      btn.textContent = 'Sign in'
      btn.disabled = false
    }
  })
}

export function renderRegister(el: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const citySlug = params.get('city') ?? ''

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-logo">${APP_NAME}</div>
      <div class="auth-card">
        <h2>Join ${citySlug ? citySlug.replace(/-/g, ' ') : 'your city'}</h2>
        <p>Create your community account.</p>
        <form class="auth-form" id="register-form">
          <input class="auth-field" name="username" placeholder="Username" required autocomplete="username" />
          <input class="auth-field" name="email" type="email" placeholder="Email" required autocomplete="email" />
          <input class="auth-field" name="password" type="password" placeholder="Password (min 8 chars)" minlength="8" required autocomplete="new-password" />
          ${citySlug
            ? `<input type="hidden" name="city" value="${citySlug}" />`
            : `<input class="auth-field" name="city" type="text" placeholder="City slug (e.g. yogyakarta-id)" required />`
          }
          <p id="register-error" class="error-msg hidden"></p>
          <button class="auth-submit" type="submit">Create account</button>
        </form>
        <p class="auth-footer">Have an account? <a href="/login?city=${citySlug}" data-link>Sign in</a></p>
      </div>
    </div>
  `

  el.querySelector('#register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const username = (form.elements.namedItem('username') as HTMLInputElement).value
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const city = (form.elements.namedItem('city') as HTMLInputElement).value
    const errEl = form.querySelector<HTMLElement>('#register-error')!
    const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!
    btn.textContent = 'Creating account…'
    btn.disabled = true
    try {
      await register(username, email, password, city)
      navigate(`/login?city=${city}`)
    } catch (err: any) {
      errEl.textContent = err.message
      errEl.classList.remove('hidden')
      btn.textContent = 'Create account'
      btn.disabled = false
    }
  })
}
