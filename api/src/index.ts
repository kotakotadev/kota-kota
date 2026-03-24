import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './types'

import auth from './routes/auth'
import cities from './routes/cities'
import posts from './routes/posts'
import comments from './routes/comments'
import tenants from './routes/tenants'
import notifications from './routes/notifications'
import uploads from './routes/uploads'
import webhooks from './routes/webhooks'

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

app.get('/', (c) => c.json({ service: `${c.env.APP_NAME} API`, status: 'ok' }))

app.route('/auth', auth)
app.route('/cities', cities)
app.route('/uploads', uploads)
app.route('/notifications', notifications)
app.route('/webhooks', webhooks)

// City-scoped routes: /:city/posts, /:city/tenants
app.route('/:city/posts/:postId/comments', comments)
app.route('/:city/posts', posts)
app.route('/:city/tenants', tenants)

// Users
app.patch('/users/:id/verify', async (c) => {
  // superadmin verifies a user
  const { Bindings: b, Variables: v } = c as any
  return c.json({ message: 'not implemented' })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
