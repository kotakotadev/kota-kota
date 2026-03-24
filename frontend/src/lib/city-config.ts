export type NavItem = {
  label: string
  path: string
}

export type CityConfig = {
  name: string
  country_code: string
  theme: {
    primary: string
    logo_url?: string
  }
  categories: string[]
  districts: string[]
  nav: NavItem[]              // custom pages shown in navbar
  rules?: string
  contact_email?: string
}

const DEFAULT_CONFIG: Partial<CityConfig> = {
  theme: { primary: '#2563eb' },
  categories: ['event', 'announcement', 'question', 'complaint', 'for-sale'],
  districts: [],
  nav: [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
    { label: 'Rules', path: '/rules' }
  ]
}

const GITHUB_ORG = import.meta.env.VITE_GITHUB_ORG ?? 'kotakotadev'

const cache = new Map<string, { config: CityConfig; ts: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes

export async function getCityConfig(citySlug: string): Promise<CityConfig> {
  const cached = cache.get(citySlug)
  if (cached && Date.now() - cached.ts < TTL) return cached.config

  const url = `https://raw.githubusercontent.com/${GITHUB_ORG}/${citySlug}/main/city.config.json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('not found')
    const data = await res.json()
    const config = { ...DEFAULT_CONFIG, ...data, theme: { ...DEFAULT_CONFIG.theme, ...data.theme } } as CityConfig
    cache.set(citySlug, { config, ts: Date.now() })
    return config
  } catch {
    // Fallback: return default with slug-derived name
    const fallback: CityConfig = {
      name: citySlug,
      country_code: '',
      theme: { primary: '#2563eb' },
      categories: DEFAULT_CONFIG.categories!,
      districts: [],
      nav: DEFAULT_CONFIG.nav!
    }
    cache.set(citySlug, { config: fallback, ts: Date.now() })
    return fallback
  }
}

export async function getCityPage(citySlug: string, page: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${GITHUB_ORG}/${citySlug}/main/pages/${page}.md`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}
