import { Suspense } from 'react'
import ClientPage from './client-page'

// useSearchParams() in the client page forces a CSR bailout: without this Suspense
// boundary the App Router prerender step fails the build. Same split as the legacy
// /onboarding/error-report route.
export default function Page() {
  return (
    <Suspense>
      <ClientPage />
    </Suspense>
  )
}
