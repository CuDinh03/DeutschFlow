/**
 * Trạng thái bảo trì hệ thống — tầng C của thiết kế
 * plans/2026-09-03-thiet-ke-co-che-bao-tri-he-thong.md (§3, §7).
 *
 * Hai việc, một chỗ:
 *  1. `isMaintenanceError` — nhận diện "tín hiệu" bảo trì trên một response lỗi bất kỳ
 *     (503 problem+json `extensions.code=MAINTENANCE`, hoặc header `X-DF-Maintenance: 1`
 *     từ nginx khi Spring đã chết).
 *  2. `probeSystemStatus` — XÁC NHẬN bằng `GET /api/public/system/status` qua `fetch` trần:
 *     không Authorization → simple request không preflight (preflight chết là browser báo
 *     network error, không phân biệt được bảo trì với mất mạng), không đi qua interceptor
 *     của axios (không retry, không refresh-token, không đệ quy tín hiệu).
 *
 * Tín hiệu chỉ là cò súng — nguồn sự thật là probe: mất mạng phía NGƯỜI DÙNG cũng sinh lỗi
 * network, nên `unknown` (probe không trả lời được) KHÔNG được coi là bảo trì.
 */

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '')
const backendOrigin = backendUrl.replace(/\/api$/, '')

export const SYSTEM_STATUS_URL = `${backendOrigin}/api/public/system/status`

/** Phần công khai của một cửa sổ bảo trì (khớp SystemStatusResponse.MaintenanceWindowPublicDto). */
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

/** Thông tin hiện trên màn chặn — gom từ probe (đủ) hoặc từ body 503 (tối thiểu). */
export interface MaintenanceInfo {
  windowId?: number
  title?: string
  note?: string
  startsAtUtc?: string
  endsAtUtc?: string
  /** Đồng hồ server tại thời điểm biết tin — countdown tính từ đây, không tin đồng hồ máy. */
  serverTimeUtc?: string
}

export type ProbeResult =
  | { kind: 'ok'; payload: SystemStatusPayload }
  | { kind: 'maintenance'; info: MaintenanceInfo; upcoming?: MaintenanceWindowPublic | null }
  | { kind: 'unknown' } // probe không trả lời được (mất mạng phía user, DNS…) — KHÔNG phải bảo trì

type ProblemLike = { extensions?: { code?: unknown } & Record<string, unknown> } & Record<string, unknown>

function extensionsOf(data: unknown): (Record<string, unknown> & { code?: unknown }) | null {
  if (!data || typeof data !== 'object') return null
  const ext = (data as ProblemLike).extensions
  return ext && typeof ext === 'object' ? ext : null
}

/** Body problem+json 503 có `extensions.code === 'MAINTENANCE'`? */
export function isMaintenanceBody(data: unknown): boolean {
  return extensionsOf(data)?.code === 'MAINTENANCE'
}

/**
 * Tín hiệu bảo trì trên một response lỗi: 503 + (body code MAINTENANCE hoặc header
 * `X-DF-Maintenance`). Header là dây bảo hiểm cho nhánh nginx tĩnh — kể cả khi body
 * không parse được, client vẫn không mù.
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

/** Rút MaintenanceInfo từ body 503 problem+json (extensions của MaintenanceModeFilter/nginx). */
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

// Single-flight: overlay poll 30s + banner poll 5' + nhiều tín hiệu interceptor cùng lúc
// chỉ được sinh MỘT request probe tại một thời điểm.
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
    // fetch trần: KHÔNG Authorization (simple request), no-store (không ăn cache già).
    const res = await fetch(SYSTEM_STATUS_URL, { cache: 'no-store' })

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
      // App chết → nginx trả JSON tĩnh cùng shape; header là dây bảo hiểm khi body hỏng.
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
