export type Bindings = {
  DB: D1Database
  R2: R2Bucket
  // App
  ENVIRONMENT: string
  APP_URL: string           // https://city.page
  APP_NAME: string          // city.page
  API_URL: string           // https://api.city.page
  UPLOADS_URL: string       // https://uploads.city.page
  // GitHub
  GITHUB_ORG: string        // kotakotadev
  GITHUB_TEMPLATE_REPO: string  // city-template
  GITHUB_BOT_TOKEN: string
  GITHUB_WEBHOOK_SECRET: string
  // Auth
  JWT_SECRET: string
  // Email worker
  EMAIL_WORKER_URL: string
  EMAIL_WORKER_SECRET: string
  RESEND_API_KEY: string
}

export type Variables = {
  userId: string
  cityId: string
  globalRole: 'superadmin' | 'user' | 'visitor'
}

export type User = {
  id: string
  city_id: string
  username: string
  email: string
  global_role: 'superadmin' | 'user' | 'visitor'
  is_verified: number
  avatar_url: string | null
  created_at: number
}

export type City = {
  id: string
  slug: string
  name: string
  country_code: string
  region: string | null
  github_repo: string
  latitude: number | null
  longitude: number | null
  is_active: number
  created_at: number
}

export type Tenant = {
  id: string
  city_id: string
  slug: string
  name: string
  category: string
  description: string | null
  is_verified: number
  avatar_url: string | null
  address: string
  district: string
  latitude: number | null
  longitude: number | null
  google_place_id: string | null
  google_maps_url: string | null
  google_place_name: string | null
  created_at: number
}

export type JWTPayload = {
  sub: string       // user id
  city_id: string
  role: string
  jti: string       // token id (for revocation)
  exp: number
}
