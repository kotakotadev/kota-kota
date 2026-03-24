type RouteHandler = (params: Record<string, string>) => void

type Route = {
  pattern: RegExp
  keys: string[]
  handler: RouteHandler
}

const routes: Route[] = []

export function on(path: string, handler: RouteHandler) {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' + path.replace(/:([^/]+)/g, (_, key) => { keys.push(key); return '([^/]+)' }) + '/?$'
  )
  routes.push({ pattern, keys, handler })
}

export function navigate(path: string) {
  history.pushState(null, '', path)
  dispatch(path)
}

function dispatch(path: string) {
  for (const { pattern, keys, handler } of routes) {
    const match = path.match(pattern)
    if (match) {
      const params: Record<string, string> = {}
      keys.forEach((k, i) => { params[k] = match[i + 1] })
      handler(params)
      return
    }
  }
}

export function startRouter() {
  window.addEventListener('popstate', () => dispatch(location.pathname))
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a[data-link]')
    if (link) {
      e.preventDefault()
      navigate((link as HTMLAnchorElement).pathname)
    }
  })
  dispatch(location.pathname)
}
