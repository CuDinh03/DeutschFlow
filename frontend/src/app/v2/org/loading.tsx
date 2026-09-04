import { RouteLoadingSkeleton } from '../routeLoadingShared'

/** Màn chờ điều hướng cho `/v2/org/*` — render trong `<main>` của GaShell, sidebar đứng yên. */
export default function V2OrgLoading() {
  return <RouteLoadingSkeleton />
}
