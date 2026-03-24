import { login, register } from '../auth'
import { navigate } from '../router'

export function renderLogin(el: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const citySlug = params.get('city') ?? ''

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-box">
        <a href="/" data-link class="brand">city.page</a>
        <h2>Login</h2>
        <form id="login-form">
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <input name="city" type="text" placeholder="City slug (e.g. yogyakarta-id)" value="${citySlug}" required />
          <button type="submit">Login</button>
          <p id="login-error" class="error hidden"></p>
        </form>
        <p>No account? <a href="/register?city=${citySlug}" data-link>Register</a></p>
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
    try {
      await login(email, password, city)
      navigate(city ? `/${city}` : '/')
    } catch (err: any) {
      errEl.textContent = err.message
      errEl.classList.remove('hidden')
    }
  })
}

export function renderRegister(el: HTMLElement) {
  const params = new URLSearchParams(location.search)
  const citySlug = params.get('city') ?? ''

  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-box">
        <a href="/" data-link class="brand">city.page</a>
        <h2>Register</h2>
        <form id="register-form">
          <input name="username" placeholder="Username" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password (min 8 chars)" minlength="8" required />
          <input name="city" type="text" placeholder="City slug (e.g. yogyakarta-id)" value="${citySlug}" required />
          <button type="submit">Create Account</button>
          <p id="register-error" class="error hidden"></p>
        </form>
        <p>Have an account? <a href="/login?city=${citySlug}" data-link>Login</a></p>
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
    try {
      await register(username, email, password, city)
      navigate(`/login?city=${city}`)
    } catch (err: any) {
      errEl.textContent = err.message
      errEl.classList.remove('hidden')
    }
  })
}
