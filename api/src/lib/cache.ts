/**
 * Cloudflare Cache API helper for Workers.
 * Caches GET responses at the edge — reduces D1 reads and GitHub API calls.
 */

export async function withCache(
  request: Request,
  ctx: ExecutionContext,
  handler: () => Promise<Response>,
  ttl: number   // seconds
): Promise<Response> {
  // Only cache GET requests
  if (request.method !== 'GET') return handler()

  // Strip Authorization header from cache key — cached responses are public
  const cacheKey = new Request(request.url, { method: 'GET' })
  const cache = caches.default

  const cached = await cache.match(cacheKey)
  if (cached) {
    const res = new Response(cached.body, cached)
    res.headers.set('X-Cache', 'HIT')
    return res
  }

  const response = await handler()

  // Only cache successful responses
  if (response.ok) {
    const toCache = new Response(response.clone().body, response)
    toCache.headers.set('Cache-Control', `public, s-maxage=${ttl}`)
    toCache.headers.set('X-Cache', 'MISS')
    ctx.waitUntil(cache.put(cacheKey, toCache))
  }

  return response
}

/**
 * Purge cached URLs after a write operation.
 * Call this after POST/PATCH/DELETE to invalidate related GET caches.
 */
export async function purgeCache(urls: string[]): Promise<void> {
  const cache = caches.default
  await Promise.all(urls.map(url => cache.delete(new Request(url))))
}
