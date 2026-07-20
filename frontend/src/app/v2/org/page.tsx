'use client'

import * as React from 'react'
import { getOrgRole } from '@/lib/authSession'
import { LoadingState } from '@/components/ui-v2'
import { OrgOwnerDashboard } from './OwnerDashboard'
import { OrgManagerDashboard } from './ManagerDashboard'

/**
 * /v2/org — trang chủ console trung tâm, MỘT route hai bảng điều khiển:
 *   • OWNER (giám đốc)  → OrgOwnerDashboard : sức khoẻ trung tâm (ghế, token pool, CEFR).
 *   • MANAGER (nhân sự) → OrgManagerDashboard : việc hôm nay (lịch buổi học, lớp thiếu giáo viên,
 *     lời mời sắp hết hạn, học viên mới nhập) — không tài chính.
 *
 * orgRole chỉ đọc được ở client (cookie/JWT, xem authSession) nên render bị giữ lại tới khi biết
 * vai trò — tránh chớp bảng OWNER (có số liệu tài chính) cho một MANAGER. Sidebar đổi menu theo
 * cùng tín hiệu này (GaSidebar → managerNav). Backend vẫn là nơi chốt quyền thật (OrgGuard).
 */
export default function V2OrgHomePage() {
  const [isOwner, setIsOwner] = React.useState<boolean | null>(null)

  React.useEffect(() => { setIsOwner(getOrgRole() === 'OWNER') }, [])

  if (isOwner === null) return <LoadingState label="Đang tải bảng điều hành…" />
  return isOwner ? <OrgOwnerDashboard /> : <OrgManagerDashboard />
}
