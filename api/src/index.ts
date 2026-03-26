import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './types'

// JSON API routes (all under /api/)
import auth from './routes/auth'
import cities from './routes/cities'
import posts from './routes/posts'
import comments from './routes/comments'
import tenants from './routes/tenants'
import notifications from './routes/notifications'
import uploads from './routes/uploads'
import webhooks from './routes/webhooks'

// SSR HTML routes (at root /)
import ssrHome from './routes/ssr/home'
import ssrCity from './routes/ssr/city'
import ssrPost from './routes/ssr/post'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = [c.env.APP_URL, 'http://localhost:5173']
    return allowed.includes(origin) ? origin : allowed[0]
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}))

// ── JSON API routes ────────────────────────────────────────────────────────────
app.get('/api', (c) => c.json({ service: `${c.env.APP_NAME} API`, status: 'ok' }))

app.route('/api/auth', auth)
app.route('/api/cities', cities)
app.route('/api/uploads', uploads)
app.route('/api/notifications', notifications)
app.route('/api/webhooks', webhooks)

// City-scoped JSON routes
app.route('/api/:city/posts/:postId/comments', comments)
app.route('/api/:city/posts', posts)
app.route('/api/:city/tenants', tenants)

app.patch('/api/users/:id/verify', async (c) => {
  return c.json({ message: 'not implemented' })
})

// ── SSR HTML routes ────────────────────────────────────────────────────────────
app.route('/', ssrHome)
app.route('/', ssrPost)    // /:city/posts/:id — must be before /:city
app.route('/', ssrCity)    // /:city

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
