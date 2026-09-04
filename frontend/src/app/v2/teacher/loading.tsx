import { RouteLoadingSkeleton } from '../routeLoadingShared'

/** Màn chờ điều hướng cho `/v2/teacher/*` — render trong `<main>` của GaShell, sidebar đứng yên. */
export default function V2TeacherLoading() {
  return <RouteLoadingSkeleton />
}
