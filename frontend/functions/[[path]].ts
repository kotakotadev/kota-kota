/**
 * CF Pages Function — proxies all dynamic requests to the Worker.
 * Static assets (/assets/*, /index.html) are served by CF Pages CDN directly
 * (excluded from this function via public/_routes.json).
 *
 * Worker handles:
 *   GET /                    → SSR home HTML
 *   GET /:city               → SSR city feed HTML
 *   GET /:city/posts/:id     → SSR post detail HTML
 *   /api/*                   → JSON API
 *
 * SPA fallback: if Worker returns 404 for a non-API GET, serve index.html
 * so the SPA router can handle the route client-side.
 */

const WORKER = 'https://kotakotadev-api.kotakota-developer.workers.dev'

// Routes the Worker doesn't handle — serve SPA index.html directly
const SPA_ONLY_ROUTES = new Set(['/login', '/register'])

export async function onRequest(context: any) {
  const url = new URL(context.request.url)
  const path = url.pathname

  // SPA-only routes: fetch index.html from Pages CDN
  if (SPA_ONLY_ROUTES.has(path)) {
    return fetch(new URL('/index.html', context.request.url).href)
  }

  // Build request to forward to Worker
  const workerUrl = WORKER + path + url.search
  const isBodyless = ['GET', 'HEAD'].includes(context.request.method)

  const res = await fetch(workerUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: isBodyless ? null : context.request.body,
    redirect: 'manual'
  })

  // For non-API GET requests that the Worker doesn't know (404/405),
  // fall back to SPA index.html so the client-side router can handle it
  if (
    context.request.method === 'GET' &&
    !path.startsWith('/api/') &&
    (res.status === 404 || res.status === 405)
  ) {
    return fetch(new URL('/index.html', context.request.url).href)
  }

  return res
}
