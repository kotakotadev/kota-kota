import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { createRepo, createWebhook } from '../lib/github'
import type { Bindings, Variables } from '../types'

const cities = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /cities — list all active cities (for map + search)
cities.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, name, country_code, region, latitude, longitude
     FROM cities WHERE is_active = 1 ORDER BY name`
  ).all()
  return c.json(results)
})

// GET /cities/:slug — single city info
cities.get('/:slug', async (c) => {
  const city = await c.env.DB.prepare(
    `SELECT id, slug, name, country_code, region, latitude, longitude
     FROM cities WHERE slug = ? AND is_active = 1`
  ).bind(c.req.param('slug')).first()
  if (!city) return c.json({ error: 'City not found' }, 404)
  return c.json(city)
})

// POST /cities — superadmin creates a new city (spawns GitHub repo)
cities.post('/', authMiddleware, requireRole('superadmin'), async (c) => {
  const { name, country_code, region, slug, latitude, longitude } = await c.req.json()
  if (!name || !country_code || !slug) return c.json({ error: 'Missing fields' }, 400)

  const repoName = slug
  const org = c.env.GITHUB_ORG
  const githubRepo = `${org}/${repoName}`

  // Create GitHub repo (forked from city-template)
  await createRepo(c.env.GITHUB_BOT_TOKEN, org, repoName)

  // Register webhook on new repo
  const webhookUrl = `${c.env.API_URL}/webhooks/github`
  await createWebhook(c.env.GITHUB_BOT_TOKEN, githubRepo, webhookUrl, c.env.GITHUB_WEBHOOK_SECRET)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO cities (id, slug, name, country_code, region, github_repo, latitude, longitude, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, slug, name, country_code, region ?? null, githubRepo, latitude ?? null, longitude ?? null, Date.now()).run()

  return c.json({ id, slug, github_repo: githubRepo }, 201)
})

export default cities
