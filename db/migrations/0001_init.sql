-- city.page D1 schema
-- Multi-tenant: all tables use city_id as discriminator

-- Master city registry
CREATE TABLE IF NOT EXISTS cities (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,       -- yogyakarta-id, jakarta-utara-id
  name            TEXT NOT NULL,              -- Yogyakarta
  country_code    TEXT NOT NULL,              -- ID, US
  region          TEXT,                       -- Jawa Tengah, Illinois
  github_repo     TEXT NOT NULL,              -- citypage/yogyakarta-id
  latitude        REAL,
  longitude       REAL,
  is_active       INTEGER DEFAULT 1,
  created_at      INTEGER NOT NULL
);

-- Users (global_role applies platform-wide)
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  username        TEXT NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  global_role     TEXT NOT NULL DEFAULT 'visitor', -- superadmin | user | visitor
  is_verified     INTEGER DEFAULT 0,
  avatar_url      TEXT,
  created_at      INTEGER NOT NULL,
  UNIQUE(city_id, username),
  UNIQUE(city_id, email)
);

-- Business / organization tenants
CREATE TABLE IF NOT EXISTS tenants (
  id                TEXT PRIMARY KEY,
  city_id           TEXT NOT NULL REFERENCES cities(id),
  slug              TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,            -- cafe | barbershop | city_council | etc
  description       TEXT,
  is_verified       INTEGER DEFAULT 0,
  avatar_url        TEXT,
  -- Physical location (required)
  address           TEXT NOT NULL,
  district          TEXT NOT NULL,
  latitude          REAL,
  longitude         REAL,
  -- Google Maps (optional)
  google_place_id   TEXT,
  google_maps_url   TEXT,
  google_place_name TEXT,
  created_at        INTEGER NOT NULL,
  UNIQUE(city_id, slug)
);

-- User <-> Tenant membership with custom roles
CREATE TABLE IF NOT EXISTS tenant_members (
  id          TEXT PRIMARY KEY,
  city_id     TEXT NOT NULL REFERENCES cities(id),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL,                  -- owner | manager | mayor | barista | etc
  created_at  INTEGER NOT NULL,
  UNIQUE(tenant_id, user_id)
);

-- Auth sessions (JWT revocation list)
CREATE TABLE IF NOT EXISTS sessions (
  token_id    TEXT PRIMARY KEY,
  city_id     TEXT NOT NULL REFERENCES cities(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  INTEGER NOT NULL,
  revoked     INTEGER DEFAULT 0
);

-- Private post author mapping (supports anonymous posts)
-- Never exposed via public API
CREATE TABLE IF NOT EXISTS post_authors (
  issue_number  INTEGER NOT NULL,
  city_id       TEXT NOT NULL REFERENCES cities(id),
  user_id       TEXT REFERENCES users(id),    -- NULL if account deleted
  tenant_id     TEXT REFERENCES tenants(id),  -- if post targets a tenant
  is_anonymous  INTEGER DEFAULT 0,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (issue_number, city_id)
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  city_id         TEXT NOT NULL REFERENCES cities(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  type            TEXT NOT NULL,              -- comment | reply | reaction | announcement
  issue_number    INTEGER NOT NULL,
  comment_id      INTEGER,
  actor_username  TEXT NOT NULL,
  is_read         INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL
);

-- Per-user notification preferences
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id             TEXT NOT NULL,
  city_id             TEXT NOT NULL REFERENCES cities(id),
  email_on_comment    INTEGER DEFAULT 1,
  email_on_reply      INTEGER DEFAULT 1,
  email_on_reaction   INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, city_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_city        ON users(city_id);
CREATE INDEX IF NOT EXISTS idx_tenants_city      ON tenants(city_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_city ON tenant_members(city_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_authors_city ON post_authors(city_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
