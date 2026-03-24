import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { withCache, purgeCache } from '../lib/cache'
import type { Bindings, Variables } from '../types'

const tenants = new Hono<{ Bindings: Bindings; Variables: Variables }>()

async function getCity(db: D1Database, slug: string) {
  return db.prepare(
    'SELECT id FROM cities WHERE slug = ? AND is_active = 1'
  ).bind(slug).first<{ id: string }>()
}

// GET /:city/tenants — cached 5 min
tenants.get('/', async (c) => {
  return withCache(c.req.raw, c.executionCtx, async () => {
    const city = await getCity(c.env.DB, c.req.param('city'))
    if (!city) return c.json({ error: 'City not found' }, 404)

    const { map, category, district } = c.req.query()
    let query: string
    let bindings: unknown[]

    if (map === '1') {
      query = 'SELECT id, slug, name, category, latitude, longitude, is_verified FROM tenants WHERE city_id = ? AND latitude IS NOT NULL'
      bindings = [city.id]
    } else {
      query = 'SELECT id, slug, name, category, district, address, is_verified, avatar_url FROM tenants WHERE city_id = ?'
      bindings = [city.id]
      if (category) { query += ' AND category = ?'; bindings.push(category) }
      if (district) { query += ' AND district = ?'; bindings.push(district) }
      query += ' ORDER BY name'
    }

    const { results } = await (c.env.DB.prepare(query) as D1PreparedStatement).bind(...bindings).all()
    return c.json(results)
  }, 300)
})

// GET /:city/tenants/:slug — cached 5 min
tenants.get('/:slug', async (c) => {
  return withCache(c.req.raw, c.executionCtx, async () => {
    const city = await getCity(c.env.DB, c.req.param('city'))
    if (!city) return c.json({ error: 'City not found' }, 404)

    const tenant = await c.env.DB.prepare(
      'SELECT * FROM tenants WHERE city_id = ? AND slug = ?'
    ).bind(city.id, c.req.param('slug')).first()
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

    const { results: members } = await c.env.DB.prepare(
      `SELECT u.username, u.avatar_url, u.is_verified, tm.role
       FROM tenant_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.city_id = ? AND tm.tenant_id = ?`
    ).bind(city.id, (tenant as any).id).all()

    return c.json({ ...tenant, members })
  }, 300)
})

// POST /:city/tenants — any 'user' can create a tenant
tenants.post('/', authMiddleware, requireRole('user'), async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const {
    name, slug, category, description, address, district,
    latitude, longitude, google_place_id, google_maps_url, google_place_name, avatar_url
  } = await c.req.json()

  if (!name || !slug || !category || !address || !district) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const id = crypto.randomUUID()
  const userId = c.get('userId')
  const now = Date.now()

  await c.env.DB.prepare(
    `INSERT INTO tenants (id, city_id, slug, name, category, description, address, district,
      latitude, longitude, google_place_id, google_maps_url, google_place_name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, city.id, slug, name, category, description ?? null, address, district,
    latitude ?? null, longitude ?? null, google_place_id ?? null,
    google_maps_url ?? null, google_place_name ?? null, avatar_url ?? null, now).run()

  // Creator becomes owner automatically
  await c.env.DB.prepare(
    'INSERT INTO tenant_members (id, city_id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), city.id, id, userId, 'owner', now).run()

  return c.json({ id, slug }, 201)
})

// PATCH /:city/tenants/:slug — tenant member can update
tenants.patch('/:slug', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const tenant = await c.env.DB.prepare(
    'SELECT id FROM tenants WHERE city_id = ? AND slug = ?'
  ).bind(city.id, c.req.param('slug')).first<{ id: string }>()
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  const userId = c.get('userId')
  const role = c.get('globalRole')

  if (role !== 'superadmin') {
    const member = await c.env.DB.prepare(
      'SELECT id FROM tenant_members WHERE tenant_id = ? AND user_id = ?'
    ).bind(tenant.id, userId).first()
    if (!member) return c.json({ error: 'Forbidden' }, 403)
  }

  const updates = await c.req.json()
  const allowed = ['name', 'description', 'address', 'district', 'latitude', 'longitude',
    'google_place_id', 'google_maps_url', 'google_place_name', 'avatar_url', 'category']
  const fields = Object.keys(updates).filter(k => allowed.includes(k))
  if (!fields.length) return c.json({ error: 'No valid fields to update' }, 400)

  const set = fields.map(f => `${f} = ?`).join(', ')
  await c.env.DB.prepare(
    `UPDATE tenants SET ${set} WHERE id = ?`
  ).bind(...fields.map(f => updates[f]), tenant.id).run()

  return c.json({ message: 'Updated' })
})

// PATCH /:city/tenants/:slug/verify — superadmin only
tenants.patch('/:slug/verify', authMiddleware, requireRole('superadmin'), async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  await c.env.DB.prepare(
    'UPDATE tenants SET is_verified = 1 WHERE city_id = ? AND slug = ?'
  ).bind(city.id, c.req.param('slug')).run()

  return c.json({ message: 'Tenant verified' })
})

// POST /:city/tenants/:slug/members
tenants.post('/:slug/members', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const tenant = await c.env.DB.prepare(
    'SELECT id FROM tenants WHERE city_id = ? AND slug = ?'
  ).bind(city.id, c.req.param('slug')).first<{ id: string }>()
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  const userId = c.get('userId')
  const role = c.get('globalRole')

  // Only existing tenant owner/manager or superadmin can add members
  if (role !== 'superadmin') {
    const member = await c.env.DB.prepare(
      "SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?"
    ).bind(tenant.id, userId).first<{ role: string }>()
    if (!member || !['owner', 'manager'].includes(member.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  const { user_id, member_role } = await c.req.json()
  if (!user_id || !member_role) return c.json({ error: 'Missing fields' }, 400)

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO tenant_members (id, city_id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), city.id, tenant.id, user_id, member_role, Date.now()).run()

  return c.json({ message: 'Member added' }, 201)
})

// DELETE /:city/tenants/:slug/members/:userId
tenants.delete('/:slug/members/:memberId', authMiddleware, async (c) => {
  const city = await getCity(c.env.DB, c.req.param('city'))
  if (!city) return c.json({ error: 'City not found' }, 404)

  const tenant = await c.env.DB.prepare(
    'SELECT id FROM tenants WHERE city_id = ? AND slug = ?'
  ).bind(city.id, c.req.param('slug')).first<{ id: string }>()
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  const userId = c.get('userId')
  const role = c.get('globalRole')

  if (role !== 'superadmin' && userId !== c.req.param('memberId')) {
    const member = await c.env.DB.prepare(
      "SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?"
    ).bind(tenant.id, userId).first<{ role: string }>()
    if (!member || !['owner', 'manager'].includes(member.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  await c.env.DB.prepare(
    'DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?'
  ).bind(tenant.id, c.req.param('memberId')).run()

  return c.json({ message: 'Member removed' })
})

export default tenants
