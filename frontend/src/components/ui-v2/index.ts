// Galerie 2.0 (UI 2.0) component library — foundational set (Phase 1).
// Per-screen components (charts, schedule grid, learning tree, …) land in Phase 2.
export { GaShell } from './GaShell'
export { GaSidebar } from './GaSidebar'
export { GaTopBar } from './GaTopBar'
export { GaShellNavProvider, useGaShellNav, GaSidebarToggle } from './GaShellNav'
export { GaPageHdr } from './GaPageHdr'
export { GaLogo } from './GaLogo'
export { GaBtn } from './GaBtn'
export { GaCap } from './GaCap'
export { GaIcon } from './GaIcon'
export { GaMedia } from './GaMedia'
export { GaCard, GaCardHeader, GaCardTitle, GaCardBody } from './GaCard'
export { TkBadge } from './TkBadge'
export { TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent } from './TkTabs'
export { TkSearch } from './TkSearch'
export { TkSeg } from './TkSeg'
export type { TkSegOption } from './TkSeg'
export { TkModal } from './TkModal'
export { DataTable } from './DataTable'
export type { DataTableColumn, DataTableProps } from './DataTable'
export { useImmersiveChrome } from './useImmersiveChrome'
export { GaStatStrip } from './GaStatStrip'
export type { GaStatItem, GaStatTone } from './GaStatStrip'
export { EmptyState } from './EmptyState'
export { ErrorBanner } from './ErrorBanner'
export { SkeletonRow } from './SkeletonRow'
export { LoadingState } from './LoadingState'
export { SkillIcon } from './SkillIcon'
// ── Wave 0 primitives (DS §8.2 + D6 adapter): control nhập liệu + progress + portal adapters.
export { GaRoleProvider, useGaShellRole } from './gaScope'
export { GaInput, GaTextarea } from './GaInput'
export type { GaInputProps, GaTextareaProps } from './GaInput'
export { GaProgress } from './GaProgress'
export type { GaProgressProps } from './GaProgress'
export { GaPopover, GaPopoverTrigger, GaPopoverContent, GaPopoverAnchor } from './GaPopover'
export { GaTooltip, GaTooltipTrigger, GaTooltipContent } from './GaTooltip'
export {
  GaSelect,
  GaSelectTrigger,
  GaSelectValue,
  GaSelectContent,
  GaSelectItem,
  GaSelectGroup,
  GaSelectLabel,
  GaSelectSeparator,
} from './GaSelect'
export { ROLE_NAV, teacherNav, adminNav, orgNav, managerNav } from './nav'
export type { RoleId, RoleNav, NavSection, NavItem } from './nav'
// ── Wave 1 / S-01 + S-13: area navigation (IA-D1/D6/D7)
export { ROLE_AREAS, studentAreas, teacherAreas, resolveArea, isUnder, isImmersiveRoute } from './nav'
export type { AreaNav, RoleAreas } from './nav'
export { GaLocalNav } from './GaLocalNav'
export { GaBottomNav } from './GaBottomNav'
export { GaAccountMenu } from './GaAccountMenu'
