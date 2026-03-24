import { getCityConfig, getCityPage } from '../lib/city-config'
import { renderMarkdown } from '../lib/markdown'
import { renderNavbar } from '../components/navbar'

const PAGE_LABELS: Record<string, string> = {
  about: 'About',
  contact: 'Contact',
  rules: 'Community Rules'
}

export async function renderCityPage(
  el: HTMLElement,
  { city, page }: { city: string; page: string }
) {
  const [config, markdown] = await Promise.all([
    getCityConfig(city),
    getCityPage(city, page)
  ])

  const label = PAGE_LABELS[page] ?? page

  el.innerHTML = `
    ${await renderNavbar(city, config)}
    <div class="city-page-wrap">
      ${markdown
        ? `<h1>${label}</h1><div class="md-body">${renderMarkdown(markdown)}</div>`
        : `<div class="not-found-page">
             <h2>${label}</h2>
             <p>This page hasn't been set up yet.</p>
             <p>City admins can create <code>pages/${page}.md</code> in the city's GitHub repo.</p>
           </div>`
      }
    </div>
  `
}
