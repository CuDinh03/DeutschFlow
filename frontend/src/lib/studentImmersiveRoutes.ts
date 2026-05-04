/**
 * Routes where the mobile bottom bar should stay hidden (full-bleed / immersive sessions).
 */

const PREFIXES = [
  "/speaking",
  "/student/vocab-practice",
  "/student/swipe-cards",
  "/student/game",
  /** Learning-plan session runner — exercises + optional speaking */
  "/student/plan/week",
] as const;

export function isStudentImmersivePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
