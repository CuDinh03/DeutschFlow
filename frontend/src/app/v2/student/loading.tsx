import { RouteLoadingSkeleton } from '../routeLoadingShared'

/** Màn chờ điều hướng cho `/v2/student/*` — render trong `<main>` của GaShell, sidebar đứng yên. */
export default function V2StudentLoading() {
  return <RouteLoadingSkeleton />
}
