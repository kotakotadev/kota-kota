/**
 * HTML shell for SSR pages.
 * Static assets are served from APP_URL (CF Pages).
 */
export interface HtmlShellOptions {
  title: string
  description?: string
  content: string
  appUrl: string
  appName: string
  ssrPage: string
  ssrInlineData?: unknown   // serialized into window.__SSR__ before app.js
  primaryColor?: string
}

export function htmlShell(opts: HtmlShellOptions): string {
  const { title, description, content, appUrl, appName, ssrPage, ssrInlineData, primaryColor } = opts
  const desc = description ?? `${appName} — community platform`
  const ssrScript = ssrInlineData
    ? `<script>window.__SSR__=${JSON.stringify(ssrInlineData)}</script>`
    : ''
  const primaryStyle = primaryColor ? `<style>:root{--primary:${primaryColor}}</style>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="${appUrl}/assets/index.css">
  ${primaryStyle}
  ${ssrScript}
</head>
<body>
  <div id="app" data-ssr="${ssrPage}">${content}</div>
  <script type="module" src="${appUrl}/assets/app.js"></script>
</body>
</html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Server-side avatar (matches frontend makeAvatar) */
export function makeAvatar(name: string, size = 36): string {
  const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F4A261', '#A78BFA', '#34D399', '#FB923C']
  const bg = palette[name.charCodeAt(0) % palette.length]
  const initials = name.slice(0, 2).toUpperCase()
  return `<div class="avatar" style="background:${bg};width:${size}px;height:${size}px">${initials}</div>`
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
