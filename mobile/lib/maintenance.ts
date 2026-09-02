// Nhận diện + thăm dò trạng thái bảo trì hệ thống (thiết kế
// plans/2026-09-03-thiet-ke-co-che-bao-tri-he-thong.md §8, tầng C mobile).
//
// Thuần, không import store/api → không tạo vòng phụ thuộc; api.ts và
// useMaintenanceStore đều dùng lại từ đây.
//
// Hai việc:
//  1. isMaintenanceError — "tín hiệu" bảo trì trên một response lỗi bất kỳ:
//     503 problem+json `extensions.code === 'MAINTENANCE'`, HOẶC header
//     `x-df-maintenance` (nginx trả JSON tĩnh khi Spring đã chết).
//  2. probeSystemStatus — XÁC NHẬN qua GET /api/public/system/status bằng fetch
//     trần (không Authorization → simple request, không đi qua interceptor axios,
//     không retry, không đệ quy tín hiệu). Mất mạng phía user ⇒ 'unknown', KHÔNG
//     coi là bảo trì.

import { API_BASE_URL } from './constants'

export const SYSTEM_STATUS_URL = `${API_BASE_URL}/public/system/status`

export interface MaintenanceWindowPublic {
  id: number
  title: string
  note?: string | null
  mode: 'FULL' | 'ANNOUNCE_ONLY'
  startsAtUtc: string
  endsAtUtc?: string | null
}

export interface SystemStatusPayload {
  status: 'OK' | 'MAINTENANCE'
  serverTimeUtc: string
  active: MaintenanceWindowPublic | null
  upcoming: MaintenanceWindowPublic | null
}

/** Thông tin hiển thị trên màn chặn — gom từ probe (đủ) hoặc body 503 (tối thiểu). */
export interface MaintenanceInfo {
  windowId?: number
  title?: string
  note?: string
  startsAtUtc?: string
  endsAtUtc?: string
  /** Đồng hồ server lúc biết tin — countdown tính từ đây, không tin đồng hồ máy. */
  serverTimeUtc?: string
}

export type ProbeResult =
  | { kind: 'ok'; payload: SystemStatusPayload }
  | { kind: 'maintenance'; info: MaintenanceInfo; upcoming?: MaintenanceWindowPublic | null }
  | { kind: 'unknown' } // probe không trả lời (mất mạng phía user…) — KHÔNG phải bảo trì

function extensionsOf(data: unknown): (Record<string, unknown> & { code?: unknown }) | null {
  if (!data || typeof data !== 'object') return null
  const ext = (data as Record<string, unknown>).extensions
  return ext && typeof ext === 'object' ? (ext as Record<string, unknown>) : null
}

/** Body problem+json có `extensions.code === 'MAINTENANCE'`? */
export function isMaintenanceBody(data: unknown): boolean {
  return extensionsOf(data)?.code === 'MAINTENANCE'
}

/**
 * Tín hiệu bảo trì trên một response lỗi: 503 + (body code MAINTENANCE hoặc header
 * x-df-maintenance). Header là dây bảo hiểm cho nhánh nginx tĩnh — body không parse
 * được vẫn không mù.
 */
export function isMaintenanceError(
  status: number | undefined,
  data: unknown,
  headers?: Record<string, unknown> | null,
): boolean {
  if (status !== 503) return false
  if (isMaintenanceBody(data)) return true
  const flag = headers?.['x-df-maintenance']
  return flag === '1' || flag === 1
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

/** Rút MaintenanceInfo từ body 503 problem+json (extensions của filter/nginx). */
export function maintenanceInfoFromProblem(data: unknown): MaintenanceInfo {
  const ext = extensionsOf(data) ?? {}
  return {
    windowId: typeof ext.windowId === 'number' ? ext.windowId : undefined,
    title: str(ext.title),
    note: str(ext.note),
    startsAtUtc: str(ext.startsAtUtc),
    endsAtUtc: str(ext.endsAtUtc),
  }
}

function infoFromWindow(w: MaintenanceWindowPublic, serverTimeUtc: string): MaintenanceInfo {
  return {
    windowId: w.id,
    title: w.title,
    note: w.note ?? undefined,
    startsAtUtc: w.startsAtUtc,
    endsAtUtc: w.endsAtUtc ?? undefined,
    serverTimeUtc,
  }
}

// Single-flight: overlay poll 30s + bootstrap + nhiều tín hiệu interceptor cùng lúc
// chỉ sinh MỘT request probe tại một thời điểm.
let inflight: Promise<ProbeResult> | null = null

export function probeSystemStatus(): Promise<ProbeResult> {
  if (inflight) return inflight
  inflight = doProbe().finally(() => {
    inflight = null
  })
  return inflight
}

async function doProbe(): Promise<ProbeResult> {
  try {
    const res = await fetch(SYSTEM_STATUS_URL, {
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const payload = (await res.json()) as SystemStatusPayload
      if (payload.status === 'MAINTENANCE' && payload.active) {
        return {
          kind: 'maintenance',
          info: infoFromWindow(payload.active, payload.serverTimeUtc),
          upcoming: payload.upcoming,
        }
      }
      return { kind: 'ok', payload }
    }

    if (res.status === 503) {
      // App chết → nginx JSON tĩnh cùng shape; header là dây bảo hiểm.
      const headerFlag = res.headers.get('x-df-maintenance') === '1'
      let body: unknown = null
      try {
        body = await res.json()
      } catch {
        /* body không parse được — dựa vào header */
      }
      if (headerFlag || isMaintenanceBody(body)) {
        return { kind: 'maintenance', info: maintenanceInfoFromProblem(body) }
      }
    }
    return { kind: 'unknown' }
  } catch {
    return { kind: 'unknown' }
  }
}
