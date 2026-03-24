import { Hono } from 'hono'
import { verifyWebhookSignature, parsePostMeta } from '../lib/github'
import type { Bindings, Variables } from '../types'

const webhooks = new Hono<{ Bindings: Bindings; Variables: Variables }>()

webhooks.post('/github', async (c) => {
  const signature = c.req.header('X-Hub-Signature-256') ?? ''
  const rawBody = await c.req.text()

  const valid = await verifyWebhookSignature(rawBody, signature, c.env.GITHUB_WEBHOOK_SECRET)
  if (!valid) return c.json({ error: 'Invalid signature' }, 401)

  const event = c.req.header('X-GitHub-Event')
  const payload = JSON.parse(rawBody)

  if (event === 'issue_comment' && payload.action === 'created') {
    await handleNewComment(c.env, payload)
  }

  return c.json({ ok: true })
})

async function handleNewComment(env: Bindings, payload: any) {
  const issueNumber: number = payload.issue.number
  const actorUsername: string = payload.comment.user.login
  const commentId: number = payload.comment.id
  const repoFullName: string = payload.repository.full_name

  // Find city by github_repo
  const city = await env.DB.prepare(
    'SELECT id FROM cities WHERE github_repo = ?'
  ).bind(repoFullName).first<{ id: string }>()
  if (!city) return

  // Find post author (private mapping)
  const postAuthor = await env.DB.prepare(
    'SELECT user_id FROM post_authors WHERE issue_number = ? AND city_id = ?'
  ).bind(issueNumber, city.id).first<{ user_id: string | null }>()
  if (!postAuthor?.user_id) return

  // Get commenter's user_id to avoid self-notification
  const commenter = await env.DB.prepare(
    'SELECT id FROM users WHERE city_id = ? AND username = ?'
  ).bind(city.id, actorUsername).first<{ id: string }>()
  if (commenter?.id === postAuthor.user_id) return

  // Check notification prefs
  const prefs = await env.DB.prepare(
    'SELECT email_on_comment FROM notification_prefs WHERE user_id = ? AND city_id = ?'
  ).bind(postAuthor.user_id, city.id).first<{ email_on_comment: number }>()

  // Write in-app notification
  const notifId = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO notifications (id, city_id, user_id, type, issue_number, comment_id, actor_username, created_at)
     VALUES (?, ?, ?, 'comment', ?, ?, ?, ?)`
  ).bind(notifId, city.id, postAuthor.user_id, issueNumber, commentId, actorUsername, Date.now()).run()

  // Send email if enabled
  if (!prefs || prefs.email_on_comment) {
    await sendEmailNotification(env, postAuthor.user_id, actorUsername, issueNumber)
  }
}

async function sendEmailNotification(env: Bindings, userId: string, actorUsername: string, issueNumber: number) {
  const user = await env.DB.prepare(
    'SELECT email FROM users WHERE id = ?'
  ).bind(userId).first<{ email: string }>()
  if (!user) return

  const isAnon = await env.DB.prepare(
    'SELECT is_anonymous FROM post_authors WHERE user_id = ?'
  ).bind(userId).first<{ is_anonymous: number }>()

  const postLabel = isAnon?.is_anonymous ? 'your anonymous post' : `post #${issueNumber}`

  await fetch(`${env.EMAIL_WORKER_URL}/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': env.EMAIL_WORKER_SECRET
    },
    body: JSON.stringify({
      to: user.email,
      subject: `[${env.APP_NAME}] ${actorUsername} commented on ${postLabel}`,
      html: `<p><strong>@${actorUsername}</strong> replied to ${postLabel}.</p>
             <p><a href="${env.APP_URL}/posts/${issueNumber}">View post →</a></p>`
    })
  })
}

export default webhooks
