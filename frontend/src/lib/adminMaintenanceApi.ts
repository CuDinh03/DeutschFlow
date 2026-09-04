import api from '@/lib/api'

/**
 * Admin API cửa sổ bảo trì — hợp đồng khớp AdminMaintenanceController (PR #488).
 * Mọi mutation đều audit phía backend; chuyển trạng thái sai trả 409 (problem+json).
 */

export interface MaintenanceWindowDto {
  id: number
  title: string
  note: string | null
  mode: 'FULL' | 'ANNOUNCE_ONLY'
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  startsAtUtc: string
  endsAtUtc: string | null
  autoActivate: boolean
  autoComplete: boolean
  notifiedScheduleAtUtc: string | null
  notifiedBeforeAtUtc: string | null
  notifiedCompleteAtUtc: string | null
  createdBy: string
  createdAtUtc: string
  updatedAtUtc: string
}

export interface MaintenancePage {
  content: MaintenanceWindowDto[]
  totalElements: number
  totalPages: number
  number: number
}

export interface CreateMaintenanceRequest {
  title: string
  note?: string | null
  startsAtUtc: string
  endsAtUtc?: string | null
  mode?: 'FULL' | 'ANNOUNCE_ONLY'
  autoActivate?: boolean
  autoComplete?: boolean
  /** Mặc định true — backend gửi ngay thông báo "có lịch" cho toàn bộ user. */
  notifyUsers?: boolean
}

export interface UpdateMaintenanceRequest {
  title?: string
  note?: string | null
  startsAtUtc?: string
  endsAtUtc?: string
  mode?: 'FULL' | 'ANNOUNCE_ONLY'
  autoActivate?: boolean
  autoComplete?: boolean
}

/** `overlappingIds`: cảnh báo mềm lịch chồng lấn — backend vẫn tạo. */
export interface CreateMaintenanceResponse {
  window: MaintenanceWindowDto
  overlappingIds: number[]
}

/** GET /admin/maintenance-windows?page&size */
export async function listMaintenanceWindows(page = 0, size = 20): Promise<MaintenancePage> {
  const res = await api.get<MaintenancePage>('/admin/maintenance-windows', { params: { page, size } })
  return res.data
}

/** POST /admin/maintenance-windows — tạo lịch (SCHEDULED); notifyUsers mặc định bật. */
export async function createMaintenanceWindow(body: CreateMaintenanceRequest): Promise<CreateMaintenanceResponse> {
  const res = await api.post<CreateMaintenanceResponse>('/admin/maintenance-windows', body)
  return res.data
}

/** PATCH /admin/maintenance-windows/{id} — SCHEDULED sửa mọi trường; ACTIVE chỉ endsAtUtc/note. */
export async function updateMaintenanceWindow(id: number, body: UpdateMaintenanceRequest): Promise<MaintenanceWindowDto> {
  const res = await api.patch<MaintenanceWindowDto>(`/admin/maintenance-windows/${id}`, body)
  return res.data
}

/** POST …/{id}/activate — bật sớm (SCHEDULED → ACTIVE, chặn NGAY). */
export async function activateMaintenanceWindow(id: number): Promise<MaintenanceWindowDto> {
  const res = await api.post<MaintenanceWindowDto>(`/admin/maintenance-windows/${id}/activate`)
  return res.data
}

/** POST …/{id}/complete — kết thúc (ACTIVE → COMPLETED + báo "đã hoạt động trở lại"). */
export async function completeMaintenanceWindow(id: number): Promise<MaintenanceWindowDto> {
  const res = await api.post<MaintenanceWindowDto>(`/admin/maintenance-windows/${id}/complete`)
  return res.data
}

/** POST …/{id}/cancel — huỷ lịch (chỉ báo huỷ cho user nếu đã từng báo có lịch). */
export async function cancelMaintenanceWindow(id: number): Promise<MaintenanceWindowDto> {
  const res = await api.post<MaintenanceWindowDto>(`/admin/maintenance-windows/${id}/cancel`)
  return res.data
}

/** POST /admin/maintenance-windows/emergency — bật bảo trì KHẨN CẤP (hiệu lực ≤15s). */
export async function emergencyMaintenance(body: {
  title?: string
  note?: string
  endsAtUtc?: string | null
}): Promise<MaintenanceWindowDto> {
  const res = await api.post<MaintenanceWindowDto>('/admin/maintenance-windows/emergency', body)
  return res.data
}
