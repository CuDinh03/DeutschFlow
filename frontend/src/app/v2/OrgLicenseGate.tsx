'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { getOrgSummary } from '@/lib/orgApi'
import { getOrgRole } from '@/lib/authSession'

/**
 * Chế độ CHỈ-ĐỌC của trung tâm, nhìn thấy được (D5 — Gói 2, E1).
 *
 * <p>`GET /api/org` đã trả `readOnly` / `readOnlyReason` / `graceEndsAt` từ đợt trước nhưng CHƯA
 * client nào dùng: người của một trung tâm bị khoá ghi vẫn thấy đủ nút "Tạo lớp", "Mời giáo viên",
 * "Nhập học viên", bấm vào mới ăn 403 — một bãi mìn, trái hẳn tinh thần D5 là chuyển sang một chế
 * độ NHÌN THẤY ĐƯỢC. Provider này nạp trạng thái MỘT lần cho cả khu, dựng băng cảnh báo dính đầu
 * trang nói rõ vì sao / còn bao lâu / làm gì để mở lại / CÁI GÌ VẪN LÀM ĐƯỢC, và cấp
 * {@link OrgWriteGate} cho từng trang vô hiệu hoá đúng các nút TẠO MỚI.
 *
 * <p>🔑 Chỉ-đọc KHÔNG chặn đường ĐỌC: `children` luôn render đầy đủ, băng chỉ được thêm vào phía
 * trên. Không có chuyện thay cả khu bằng một màn "trung tâm đã khoá".
 *
 * <p>🔑 LUẬT MỘT-ĐỔI-MỘT: web chỉ khoá đúng những đường máy chủ đang chặn. Danh mục ngoại lệ E1 —
 * chốt điểm, bảng công, điểm danh, gỡ thành viên, đổi vai, chuyển quyền giám đốc, tự rời trung tâm
 * — KHÔNG đi qua `OrgGuard.assertOrgWritable` ở máy chủ, nên ở đây cũng TUYỆT ĐỐI không bọc
 * `OrgWriteGate`. Khoá thừa một nút E1 là chặn người dùng hoàn tất việc đã nhận (và chặn cả đường
 * GIẢM ghế), tệ hơn hẳn việc để lọt một nút tạo mới.
 *
 * <p>Lỗi tải hoặc chưa tải xong ⇒ coi như CÒN GHI ĐƯỢC (`readOnly: false`). Fail-open ở ĐÂY là
 * đúng: cổng thật nằm ở backend (`OrgGuard`), còn khoá giao diện theo một lần gọi API hỏng sẽ biến
 * một sự cố mạng thành "trung tâm của bạn bị đình chỉ" — lời nói dối tệ hơn cả bãi mìn.
 */

export type OrgReadOnlyReason = 'EXPIRED' | 'SUSPENDED'

export interface OrgLicenseState {
  readOnly: boolean
  reason: OrgReadOnlyReason | null
  /** Mốc CẮT quyền lợi (ISO) — máy chủ đã cộng 7 ngày ân hạn vào đúng mốc neo. */
  graceEndsAt: string | null
}

const FALLBACK: OrgLicenseState = { readOnly: false, reason: null, graceEndsAt: null }

const OrgLicenseContext = React.createContext<OrgLicenseState>(FALLBACK)

/** Trạng thái giấy phép của trung tâm đang mở. Ngoài provider → mặc định "còn ghi được". */
export function useOrgLicense(): OrgLicenseState {
  return React.useContext(OrgLicenseContext)
}

/**
 * Cặp `(readOnly, blockedTitle)` cho một nút TẠO MỚI.
 *
 * <p>Trả `blockedTitle` chứ không giấu nút: giấu đi thì người dùng chỉ thấy chức năng "biến mất" và
 * không có manh mối nào về nguyên nhân. Phần lớn trang nên dùng {@link OrgWriteGate} thay vì gọi
 * hook trực tiếp — nó lo nốt phần tooltip + mô tả cho trình đọc màn hình.
 */
export function useOrgReadOnly(): { readOnly: boolean; blockedTitle: string | undefined } {
  const { readOnly, reason } = useOrgLicense()
  const t = useTranslations('v2.orgReadOnly')
  if (!readOnly) return { readOnly: false, blockedTitle: undefined }
  return {
    readOnly: true,
    blockedTitle: reason === 'SUSPENDED' ? t('tooltipSuspended') : t('tooltipExpired'),
  }
}

type LockableProps = { disabled?: boolean; 'aria-describedby'?: string }

/**
 * Bọc MỘT nút GHI: trung tâm chỉ-đọc thì vô hiệu hoá nó và nói vì sao.
 *
 * <p>Ba chi tiết không hiển nhiên, đều là lý do component này tồn tại thay vì mỗi trang tự làm:
 * <ul>
 *   <li>`title` phải nằm trên phần tử BỌC. `GaBtn` có `disabled:pointer-events-none`, nên tooltip
 *       đặt trên chính nút bị vô hiệu hoá sẽ KHÔNG BAO GIỜ hiện — chuột không chạm tới nó.</li>
 *   <li>Nút `disabled` không nhận được tiêu điểm, nên `aria-describedby` một mình vẫn im lặng với
 *       người dùng bàn phím. Kèm thêm một dòng `sr-only` NGAY SAU nút để trình đọc màn hình đọc
 *       được lý do khi lướt qua vùng đó.</li>
 *   <li>Trung tâm khoẻ ⇒ trả thẳng `children`, không thêm một lớp DOM nào — bọc vô điều kiện sẽ
 *       phá bố cục `flex gap` của các hàng nút hiện có.</li>
 * </ul>
 *
 * @param when Chỉ khoá khi điều kiện này đúng. Dùng cho khu giáo viên: cổng máy chủ
 *   {@code assertClassOrgWritable} quyết theo `teacher_classes.org_id`, nên một giáo viên vừa dạy
 *   lớp trung tâm vừa dạy lớp riêng chỉ được khoá ở LỚP TRUNG TÂM. Truyền `when={isOrgClass}` để
 *   không khoá oan lớp B2C — máy chủ vẫn cho ghi lớp đó.
 */
export function OrgWriteGate({
  children,
  when = true,
}: {
  children: React.ReactElement<LockableProps>
  when?: boolean
}) {
  const { readOnly, blockedTitle } = useOrgReadOnly()
  const descId = React.useId()

  if (!readOnly || !when) return children

  return (
    <span title={blockedTitle} className="inline-flex">
      {React.cloneElement(children, { disabled: true, 'aria-describedby': descId })}
      <span id={descId} className="sr-only">
        {blockedTitle}
      </span>
    </span>
  )
}

/** Số ngày còn lại tới mốc cắt, làm tròn LÊN. null khi không có mốc; 0 khi đã quá hạn. */
export function daysUntil(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.ceil((target - now) / 86_400_000))
}

/**
 * Nạp trạng thái giấy phép cho cả khu.
 *
 * <p>Chỉ gọi API khi người dùng THỰC SỰ thuộc một trung tâm (`auth_org_role` khác rỗng). Khu
 * `/v2/teacher` có cả giáo viên B2C thuần; với họ `GET /api/org` trả 403 "Bạn không thuộc tổ chức
 * nào" — một lỗi vô hại nhưng bắn ở MỌI lần mở trang, làm bẩn log và nhật ký mạng của chính người
 * đang đi soát sự cố.
 *
 * <p>Vai trò trung tâm có thể CHƯA BIẾT ngay lúc mount: người dùng quay lại trang khi access token
 * đã hết hạn thì chỉ còn refresh cookie HttpOnly, và `auth_org_role` rỗng cho tới khi interceptor
 * 401-refresh khôi phục token. Kiểm một lần rồi thôi sẽ bỏ qua băng cảnh báo cho đúng nhóm người
 * ấy suốt cả phiên. Vì vậy poll lại theo đúng nhịp `RoleAreaGuard` đang dùng, tối đa ~15 giây.
 */
const ROLE_RECHECK_INTERVAL_MS = 500
const ROLE_RECHECK_MAX_ATTEMPTS = 30

export function OrgLicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OrgLicenseState>(FALLBACK)

  React.useEffect(() => {
    let alive = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = () => {
      getOrgSummary()
        .then((s) => {
          if (!alive) return
          setState({
            readOnly: Boolean(s.readOnly),
            reason: s.readOnlyReason ?? null,
            graceEndsAt: s.graceEndsAt ?? null,
          })
        })
        .catch(() => {
          // Xem phần đầu file: API hỏng KHÔNG được hiện thành "trung tâm bị khoá".
          if (alive) setState(FALLBACK)
        })
    }

    const tick = () => {
      if (!alive) return
      if (getOrgRole()) {
        load()
        return
      }
      attempts += 1
      if (attempts >= ROLE_RECHECK_MAX_ATTEMPTS) return
      timer = setTimeout(tick, ROLE_RECHECK_INTERVAL_MS)
    }

    tick()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <OrgLicenseContext.Provider value={state}>
      <OrgReadOnlyBanner />
      {children}
    </OrgLicenseContext.Provider>
  )
}

/**
 * Băng cảnh báo: vì sao — còn bao lâu — làm gì để mở lại — cái gì vẫn làm được.
 *
 * <p>`sticky top-0`: `<main>` của `GaShell` là vùng cuộn duy nhất và băng là phần tử đầu tiên bên
 * trong nó, nên băng dính lại ở mép trên khi người dùng cuộn xuống. Không dùng `fixed` — shell là
 * flex `h-[100dvh]`, một phần tử `fixed` sẽ CHE nội dung thay vì đẩy bố cục (cùng lý do
 * `MaintenanceBanner` là anh em flex).
 */
export function OrgReadOnlyBanner() {
  const { readOnly, reason, graceEndsAt } = useOrgLicense()
  const t = useTranslations('v2.orgReadOnly')
  const remaining = daysUntil(graceEndsAt)

  if (!readOnly) return null

  const suspended = reason === 'SUSPENDED'
  const cutDate = graceEndsAt ? new Date(graceEndsAt).toLocaleDateString() : null

  return (
    <div
      role="status"
      data-testid="org-read-only-banner"
      className="sticky top-0 z-20 flex flex-wrap items-start gap-3 border-b px-4 py-3 backdrop-blur sm:px-6 lg:px-10"
      style={{
        background: 'var(--ga-red-soft)',
        borderColor: 'color-mix(in srgb, var(--ga-red) 35%, transparent)',
      }}
    >
      <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: 'var(--ga-red)' }} />
      <div className="min-w-0 flex-1">
        <p className="ga-ui text-ga-body font-semibold" style={{ color: 'var(--ga-red)' }}>
          {suspended ? t('titleSuspended') : t('titleExpired')}
        </p>
        <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('effect')}</p>
        {/* E1: nói thẳng cái gì VẪN làm được — nếu không, người dùng tưởng mọi thao tác đều chết
            và bỏ dở đúng những việc hệ thống cố ý giữ mở (chấm nốt bài, chốt bảng công, giảm ghế). */}
        <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('stillAllowed')}</p>
        <p className="ga-ui mt-1 text-ga-small text-ga-muted">
          {remaining == null
            ? t('graceUnknown')
            : remaining === 0
              ? t('graceOver')
              : t('graceLeft', { days: remaining, date: cutDate ?? '' })}
        </p>
        <p className="ga-ui mt-1 text-ga-small font-semibold text-ga-ink">
          {suspended ? t('fixSuspended') : t('fixExpired')}
        </p>
      </div>
    </div>
  )
}
