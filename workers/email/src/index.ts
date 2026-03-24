import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT ?? 3000
const WORKER_SECRET = process.env.WORKER_SECRET ?? ''
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''

// Auth middleware — only CF Workers can call this
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  if (req.headers['x-worker-secret'] !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'city.page <noreply@city.page>',
      to,
      subject,
      html
    })
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }

  return res.json({ message: 'Email sent' })
})

app.listen(PORT, () => console.log(`Email worker running on port ${PORT}`))
