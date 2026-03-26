export type CityConfig = {
  name: string
  country_code: string
  theme: { primary: string; logo_url?: string }
  categories: string[]
  districts: string[]
  nav: { label: string; path: string }[]
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

export async function getCityConfig(org: string, slug: string): Promise<CityConfig> {
  const url = `https://raw.githubusercontent.com/${org}/${slug}/main/city.config.json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('not found')
    const data = await res.json() as Record<string, any>
    return {
      ...DEFAULT_CONFIG,
      ...data,
      theme: { ...DEFAULT_CONFIG.theme, ...data.theme }
    } as CityConfig
  } catch {
    return {
      name: slug,
      country_code: '',
      theme: { primary: '#2563eb' },
      categories: DEFAULT_CONFIG.categories!,
      districts: [],
      nav: DEFAULT_CONFIG.nav!
    }
  }
}

export async function getCityPage(org: string, slug: string, page: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${org}/${slug}/main/pages/${page}.md`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}
