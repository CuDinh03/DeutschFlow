import LoginClient from './LoginClient'

// Force dynamic rendering for /login. Without this the page is statically
// prerendered and Amplify/CloudFront serve it with `Cache-Control: s-maxage=31536000`
// (1 year). The galerie-v2 route-in lives in the client bundle referenced by the
// /login HTML shell — a stale-cached shell points at OLD chunks and never ships the
// route-in, so users keep landing on legacy even after a successful deploy.
// `force-dynamic` => no prerender, no s-maxage, always served fresh from the latest build.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginClient />
}
