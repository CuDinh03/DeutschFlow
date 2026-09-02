import { RouteLoadingSkeleton } from '../routeLoadingShared'

/** Màn chờ điều hướng cho `/v2/admin/*` — render trong `<main>` của GaShell, sidebar đứng yên. */
export default function V2AdminLoading() {
  return <RouteLoadingSkeleton />
}
