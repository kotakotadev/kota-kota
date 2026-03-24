const GH_API = 'https://api.github.com'

async function ghFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'kotakotadev-bot',
      ...(options.headers ?? {})
    }
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API ${res.status}: ${err}`)
  }
  return res.json()
}

export async function listIssues(token: string, repo: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ state: 'open', per_page: '20', ...params }).toString()
  return ghFetch(token, `/repos/${repo}/issues?${qs}`)
}

export async function getIssue(token: string, repo: string, number: number) {
  return ghFetch(token, `/repos/${repo}/issues/${number}`)
}

export async function createIssue(token: string, repo: string, data: {
  title: string
  body: string
  labels?: string[]
}) {
  return ghFetch(token, `/repos/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function listComments(token: string, repo: string, issueNumber: number) {
  return ghFetch(token, `/repos/${repo}/issues/${issueNumber}/comments`)
}

export async function createComment(token: string, repo: string, issueNumber: number, body: string) {
  return ghFetch(token, `/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body })
  })
}

export async function deleteComment(token: string, repo: string, commentId: number) {
  const res = await fetch(`${GH_API}/repos/${repo}/issues/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kotakotadev-bot'
    }
  })
  if (!res.ok && res.status !== 404) throw new Error(`GitHub API ${res.status}`)
}

export async function closeIssue(token: string, repo: string, issueNumber: number) {
  return ghFetch(token, `/repos/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' })
  })
}

export async function createRepo(token: string, org: string, repoName: string) {
  return ghFetch(token, `/orgs/${org}/repos`, {
    method: 'POST',
    body: JSON.stringify({
      name: repoName,
      description: `city.page community — ${repoName}`,
      private: false,
      has_issues: true,
      has_projects: false,
      has_wiki: false,
      auto_init: true
    })
  })
}

export async function createWebhook(token: string, repo: string, webhookUrl: string, secret: string) {
  return ghFetch(token, `/repos/${repo}/hooks`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['issue_comment', 'issues'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret
      }
    })
  })
}

export function buildPostBody(content: string, meta: {
  anonymous: boolean
  author_id?: string
  tenant_id?: string
}): string {
  const metaBlock = JSON.stringify(meta)
  return `${content}\n\n<!--citypage:${metaBlock}-->`
}

export function parsePostMeta(body: string): { anonymous: boolean; author_id?: string; tenant_id?: string } | null {
  const match = body.match(/<!--citypage:(.+?)-->/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

export async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return expected === signature
}
