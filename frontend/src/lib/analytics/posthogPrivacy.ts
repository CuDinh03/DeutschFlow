import type { CaptureResult, CapturedNetworkRequest, PostHog, Properties } from 'posthog-js'
import { SECRET_QUERY_PARAMS, scrubUrl, scrubUrlsInText } from './scrubUrl'

/**
 * Lớp lọc PostHog cho QLT-20 (kế hoạch A1 09/11/2026): token/mã một lần không được rời trình duyệt trong
 * URL gửi analytics — kể cả thuộc tính posthog-js TỰ gắn (`$current_url`, `$referrer`, `$pathname`,
 * `$initial_*`, `$session_entry_*`, `$prev_pageview_*`), autocapture, heatmap, pageleave và bản ghi phiên.
 *
 * posthog-js 1.37x: `sanitize_properties` đã deprecated → dùng `before_send` (chạy cho MỌI sự kiện đi qua
 * `capture`, kể cả `$snapshot` của bản ghi phiên, sau khi thư viện đã gắn thuộc tính tự động).
 */

/** Khoá thuộc tính mang URL/path: `$current_url`, `$initial_referrer`, `$session_entry_pathname`, `path`… */
const URL_KEY_RE = /(url|referrer|pathname|href)$/i
const PLAIN_URL_KEYS = new Set(['path'])

/** rrweb: 4 = Meta (`data.href`), 5 = Custom (`$url_changed`/`$pageview` mang `data.payload.href`). */
const RRWEB_META = 4
const RRWEB_CUSTOM = 5

/** Khoá posthog-js lưu URL vào lần đầu gặp người dùng (localStorage/cookie), gửi kèm mỗi lần hỏi cờ. */
const INITIAL_PERSON_INFO = '$initial_person_info'

type AnyRecord = Record<string, unknown>

/** Chỉ đối tượng thuần (không Date, không mảng) — `$event_time_override_system_time` là Date. */
function isRecord(v: unknown): v is AnyRecord {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function scrubElement(el: unknown): unknown {
  if (!isRecord(el)) return el
  const out: AnyRecord = { ...el }
  if (typeof out.attr__href === 'string') out.attr__href = scrubUrl(out.attr__href)
  if (typeof out.href === 'string') out.href = scrubUrl(out.href)
  if (typeof out.$el_text === 'string') out.$el_text = scrubUrlsInText(out.$el_text)
  if (typeof out.text === 'string') out.text = scrubUrlsInText(out.text)
  return out
}

function scrubHeatmapData(data: AnyRecord): AnyRecord {
  const out: AnyRecord = {}
  for (const [url, points] of Object.entries(data)) {
    const key = scrubUrl(url)
    const prev = out[key]
    out[key] = Array.isArray(prev) && Array.isArray(points) ? [...prev, ...points] : points
  }
  return out
}

function scrubSnapshotEvent(ev: unknown): unknown {
  if (!isRecord(ev) || !isRecord(ev.data)) return ev
  if (ev.type === RRWEB_META && typeof ev.data.href === 'string') {
    return { ...ev, data: { ...ev.data, href: scrubUrl(ev.data.href) } }
  }
  const payload = ev.data.payload
  if (ev.type === RRWEB_CUSTOM && isRecord(payload) && typeof payload.href === 'string') {
    return { ...ev, data: { ...ev.data, payload: { ...payload, href: scrubUrl(payload.href) } } }
  }
  return ev
}

/** Đối tượng lồng (`$set`, `$set_once`, `$web_vitals_*_event` mang `$current_url`…) cũng được lọc. */
const MAX_DEPTH = 4

/** Bản sao `props` đã lọc mọi giá trị mang URL. Không đụng giá trị khác. */
export function scrubProperties(props: Properties, depth = 0): Properties {
  const out: Properties = {}
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && (URL_KEY_RE.test(key) || PLAIN_URL_KEYS.has(key))) {
      out[key] = scrubUrl(value)
    } else if (typeof value === 'string' && (key === '$el_text' || key === '$elements_chain')) {
      out[key] = scrubUrlsInText(value)
    } else if (key === '$elements' && Array.isArray(value)) {
      out[key] = value.map(scrubElement)
    } else if (key === '$heatmap_data' && isRecord(value)) {
      out[key] = scrubHeatmapData(value)
    } else if (key === '$snapshot_data' && Array.isArray(value)) {
      out[key] = value.map(scrubSnapshotEvent)
    } else if (isRecord(value) && depth < MAX_DEPTH) {
      out[key] = scrubProperties(value, depth + 1)
    } else {
      out[key] = value
    }
  }
  return out
}

/** `before_send`: lọc thuộc tính sự kiện + thuộc tính người dùng (`$set`, `$set_once` chứa `$initial_*`). */
export function scrubPostHogEvent(cr: CaptureResult | null): CaptureResult | null {
  if (!cr) return cr
  const out: CaptureResult = { ...cr, properties: scrubProperties(cr.properties ?? {}) }
  if (cr.$set) out.$set = scrubProperties(cr.$set)
  if (cr.$set_once) out.$set_once = scrubProperties(cr.$set_once)
  return out
}

/** Bản ghi phiên: URL của request mạng VÀ href trang (posthog-js đưa cả hai qua hàm này). */
export function scrubCapturedNetworkRequest(req: CapturedNetworkRequest): CapturedNetworkRequest {
  return typeof req.name === 'string' ? { ...req, name: scrubUrl(req.name) } : req
}

/**
 * URL lần đầu (`$initial_person_info`) được posthog-js lưu bền và gửi kèm MỖI lần hỏi feature flag —
 * đường đó không qua `before_send`. Lọc bản đã lưu (kể cả bản cũ trước QLT-20 của người dùng hiện có).
 */
export function scrubStoredPersonInfo(ph: PostHog): void {
  try {
    const persistence = ph.persistence
    const info = persistence?.props?.[INITIAL_PERSON_INFO]
    if (!persistence || !isRecord(info)) return
    const next: AnyRecord = { ...info }
    if (typeof info.u === 'string') next.u = scrubUrl(info.u)
    if (typeof info.r === 'string') next.r = scrubUrl(info.r)
    if (next.u !== info.u || next.r !== info.r) persistence.register({ [INITIAL_PERSON_INFO]: next })
  } catch {
    // analytics hỏng không được làm hỏng trang
  }
}

/**
 * Phần cấu hình riêng tư gộp vào `posthog.init`. `mask_personal_data_properties` + danh sách bí mật là lớp
 * thứ hai ngay tại nguồn (posthog-js che query trước khi lưu URL lần đầu / heatmap); lớp chính vẫn là
 * `before_send` vì nó che được cả token nằm trong path.
 */
export function posthogPrivacyConfig(ph: PostHog) {
  return {
    mask_personal_data_properties: true,
    custom_personal_data_properties: [...SECRET_QUERY_PARAMS],
    before_send: (cr: CaptureResult | null) => {
      // Lần capture đầu tiên vừa ghi `$initial_person_info` ngay trước bước này.
      scrubStoredPersonInfo(ph)
      return scrubPostHogEvent(cr)
    },
  }
}
