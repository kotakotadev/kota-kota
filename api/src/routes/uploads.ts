import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const uploads = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const ALLOWED_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// POST /uploads — browser sends file directly to Worker → stored in R2
// Worker sets Cache-Control: 1 year (immutable, UUID filename never changes)
uploads.post('/', authMiddleware, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const citySlug = formData.get('city_slug') as string | null

  if (!file || !citySlug) return c.json({ error: 'Missing file or city_slug' }, 400)
  if (file.size > MAX_SIZE) return c.json({ error: 'File too large (max 5MB)' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const contentType = ALLOWED_TYPES[ext]
  if (!contentType) return c.json({ error: 'File type not allowed' }, 400)

  const key = `${citySlug}/uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  await c.env.R2.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      // Long cache: files use random UUID names, they never change
      cacheControl: 'public, max-age=31536000, immutable'
    }
  })

  return c.json({ url: `${c.env.UPLOADS_URL}/${key}` }, 201)
})

export default uploads
