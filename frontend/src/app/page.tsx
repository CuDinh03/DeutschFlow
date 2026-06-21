import '@/styles/galerie.css'
import HomeClient from './HomeClient'

/**
 * Homepage `/` — the Galerie marketing landing (shared GaLanding component).
 *
 * `force-dynamic`: like /login and the /v2 surface, the homepage must NOT be
 * statically prerendered and served with Next's default 1-year
 * `Cache-Control: s-maxage=31536000`. That long cache is what pinned a stale
 * shell on Amplify/CloudFront so the cutover never reached visitors. Dynamic
 * rendering keeps `/` fresh on every deploy.
 *
 * `.ga-scope` + galerie.css activate the UI 2.0 token layer for this route only;
 * the auth/native routing lives in the client child (HomeClient).
 */
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <div className="ga-scope min-h-screen bg-ga-bg">
      <HomeClient />
    </div>
  )
}
