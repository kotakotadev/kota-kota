import type { JWTPayload } from '../types'

const EXP_SECONDS = 60 * 60 * 24 * 30 // 30 days

async function hmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeB64url(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

export async function signJWT(payload: Omit<JWTPayload, 'exp'>, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + EXP_SECONDS
  })))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [header, body, sig] = token.split('.')
    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      new TextEncoder().encode(`${header}.${body}`)
    )
    if (!valid) return null
    const payload: JWTPayload = JSON.parse(decodeB64url(body))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
