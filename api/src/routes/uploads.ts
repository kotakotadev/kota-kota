import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const uploads = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /uploads/sign — returns a presigned R2 upload URL
uploads.post('/sign', authMiddleware, async (c) => {
  const { filename, content_type, city_slug } = await c.req.json()
  if (!filename || !content_type || !city_slug) {
    return c.json({ error: 'Missing fields' }, 400)
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  if (!allowed.includes(ext)) return c.json({ error: 'File type not allowed' }, 400)

  const key = `${city_slug}/uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  // R2 presigned URL (valid 5 minutes)
  const url = await c.env.R2.createMultipartUpload(key)

  return c.json({ key, upload_id: url.uploadId })
})

// POST /uploads/complete — finalize multipart upload and return public URL
uploads.post('/complete', authMiddleware, async (c) => {
  const { key, upload_id, parts } = await c.req.json()
  if (!key || !upload_id || !parts) return c.json({ error: 'Missing fields' }, 400)

  const upload = c.env.R2.resumeMultipartUpload(key, upload_id)
  await upload.complete(parts)

  const publicUrl = `${c.env.UPLOADS_URL}/${key}`
  return c.json({ url: publicUrl })
})

export default uploads
