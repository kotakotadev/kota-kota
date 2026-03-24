import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { Bindings, Variables } from '../types'

const notifications = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /notifications — unread count + list
notifications.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT id, type, issue_number, comment_id, actor_username, is_read, created_at
     FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(userId).all()

  const unread = results.filter((n: any) => !n.is_read).length
  return c.json({ unread, notifications: results })
})

// PATCH /notifications/:id/read
notifications.patch('/:id/read', authMiddleware, async (c) => {
  const userId = c.get('userId')
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).bind(c.req.param('id'), userId).run()
  return c.json({ message: 'Marked as read' })
})

// PATCH /notifications/read-all
notifications.patch('/read-all', authMiddleware, async (c) => {
  const userId = c.get('userId')
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?'
  ).bind(userId).run()
  return c.json({ message: 'All marked as read' })
})

export default notifications
