/**
 * Canonical public origin for the web app — used for SEO canonical URLs, Open Graph,
 * sitemap, and robots. Override per-environment with NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mydeutschflow.com').replace(/\/$/, '')

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
