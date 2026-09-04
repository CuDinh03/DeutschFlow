'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getKnownAuthRole, getOrgRole } from '@/lib/authSession'
import { homeFor, leadsOrg } from '@/lib/roleRouting'

/**
 * RoleAreaGuard — cổng vai trò PHÍA CLIENT cho bốn khu vực /v2 (admin · teacher · student · org).
 *
 * Vì sao tồn tại: cổng vai trò thật nằm ở middleware edge (src/middleware.ts), nhưng nó chỉ chạy
 * khi Amplify có JWT_RSA_PUBLIC_KEY / JWT_SECRET để verify token. Thiếu biến đó (hiện trạng prod
 * 2026-08-25), middleware degrade thành "có cookie là cho qua" — một học viên (hoặc cookie giả)
 * mở được nguyên vỏ trang admin. Guard này là lớp phòng thủ thứ hai trên client: đọc vai trò từ
 * cookie auth_role / JWT (cùng nguồn RoleShell tin), sai khu vực thì đá về trang chủ vai trò đó.
 * Dữ liệu vốn đã được backend gác (@PreAuthorize) — guard này chặn nốt phần vỏ UI/điều hướng.
 *
 * Logic được/không được vào PHẢN CHIẾU middleware — sửa bên nào thì soát bên kia:
 *   admin   → ADMIN; teacher → TEACHER; student → STUDENT (trừ trang dùng chung bên dưới);
 *   org     → OWNER/MANAGER, hoặc TEACHER legacy còn mang orgRole điều hành (leadsOrg).
 *
 * Trạng thái CHƯA BIẾT vai trò (getKnownAuthRole() === null — người dùng quay lại, chỉ còn refresh
 * cookie HttpOnly): KHÔNG đá. Đá lúc này là đuổi nhầm admin thật về trang học viên trước khi
 * interceptor 401-refresh kịp khôi phục token (middleware cũng pass-through đúng trường hợp này).
 * Thay vào đó render bình thường và poll lại tới khi biết vai trò rồi mới quyết.
 */

export type RoleArea = 'admin' | 'teacher' | 'student' | 'org'

// Bản sao client của V2_LEARNER_SHARED trong middleware: trang student mà TEACHER/ADMIN vẫn được mở.
const STUDENT_SHARED_PATHS = new Set(['/v2/student/news'])

const RECHECK_INTERVAL_MS = 500
// ~15s — quá đủ cho interceptor 401-refresh khôi phục access token; hết hạn thì thôi poll và để
// nguyên trang (dữ liệu vẫn do backend gác).
const RECHECK_MAX_ATTEMPTS = 30

/** trailingSlash: true → pathname thật là '/v2/student/news/'; so khớp trên dạng đã bỏ "/" cuối. */
function routeKey(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function isAllowedInArea(area: RoleArea, role: string, orgRole: string, pathname: string): boolean {
  if (area === 'admin') return role === 'ADMIN'
  if (area === 'teacher') return role === 'TEACHER'
  if (area === 'org') {
    return role === 'OWNER' || role === 'MANAGER' || (role === 'TEACHER' && leadsOrg(orgRole))
  }
  if (STUDENT_SHARED_PATHS.has(routeKey(pathname))) {
    return role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN'
  }
  return role === 'STUDENT'
}

export function RoleAreaGuard({ area, children }: { area: RoleArea; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [blocked, setBlocked] = React.useState(false)

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let attempts = 0

    // true = đã quyết xong (được vào hoặc đã đá); false = chưa biết vai trò, cần thử lại.
    const evaluate = (): boolean => {
      const role = getKnownAuthRole()
      if (!role) return false
      const orgRole = getOrgRole()
      if (!isAllowedInArea(area, role, orgRole, pathname)) {
        setBlocked(true)
        router.replace(homeFor(role, { orgRole }))
      }
      return true
    }

    if (evaluate()) return
    timer = setInterval(() => {
      attempts += 1
      if (evaluate() || attempts >= RECHECK_MAX_ATTEMPTS) {
        if (timer) clearInterval(timer)
        timer = null
      }
    }, RECHECK_INTERVAL_MS)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [area, pathname, router])

  if (blocked) return null
  return <>{children}</>
}
