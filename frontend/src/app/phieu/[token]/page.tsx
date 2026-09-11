import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReportSheet } from '@/components/report/ReportSheet'
import { HTML_LANG, reportSheetDict, resolveReportLang, type ReportLang } from '@/lib/reportSheetDict'
import { absoluteUrl } from '@/lib/siteUrl'
import { fetchPublicReportIssue } from './fetchReportIssue'
import { PrintButton } from './PrintButton'

/**
 * Trang phiếu đánh giá gửi gia đình — `/phieu/{token}?lang=vi|en|de` (R1/R8/R9, thiết kế §3.2).
 *
 * Server component, không đăng nhập: token trong URL là bí mật duy nhất, nên trang này cố ý KHÔNG có
 * bất cứ đường nào để dò. Backend trả CÙNG MỘT 404 cho token sai / hết hạn / đã thu hồi
 * (`ReportIssueService.NOT_FOUND_MESSAGE`), và trang cũng chỉ gọi `notFound()` — không phân biệt, không
 * thông điệp riêng, để người cầm link không suy ra được phiếu có tồn tại hay không.
 *
 * `noindex, nofollow` ở metadata + `Disallow: /phieu/` trong `robots.ts` + `no-store` phía backend:
 * điểm số của một đứa trẻ không nằm trong cache hay chỉ mục nào.
 *
 * Ngôn ngữ đọc từ `?lang` chứ KHÔNG từ cookie `locale`: phụ huynh mở link trên máy của mình, chưa từng
 * đặt cookie nào của DeutschFlow, và trung tâm đã chọn ngôn ngữ lúc phát hành (link backend trả về
 * mang sẵn `?lang=`). Giá trị lạ ⇒ tiếng Việt.
 *
 * KHÔNG có nút tải PDF ở đây (§5 mặc định) — chỉ In, khổ A4 dọc.
 */

/**
 * Thẻ chia sẻ tối giản: tên phiếu + tên trung tâm, **không tên học viên** (thiết kế §3.2) — link dán
 * vào Zalo/Messenger không được tự bung tên một đứa trẻ ra ô xem trước của người khác trong nhóm chat.
 * Không gọi API ở đây: metadata chạy trước khi trang render, mỗi lượt gọi đều tăng `view_count` và ghi
 * vết `report.viewed`, nên gọi hai lần là một lượt xem hoá thành hai trong sổ của trung tâm.
 */
export function generateMetadata({
  searchParams,
}: {
  params: { token: string }
  searchParams?: Record<string, string | string[] | undefined>
}): Metadata {
  const lang = resolveReportLang(searchParams?.lang)
  const dict = reportSheetDict(lang)
  return {
    title: `${dict.docTitle} | DeutschFlow`,
    description: dict.privacyNote,
    robots: { index: false, follow: false },
  }
}

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const issue = await fetchPublicReportIssue(params.token)
  if (!issue) notFound()

  // `?lang` là ý muốn của người mở; thiếu/lạ thì dùng ngôn ngữ đã đóng băng lúc phát hành, cuối cùng mới vi.
  const lang: ReportLang = searchParams?.lang
    ? resolveReportLang(searchParams.lang)
    : resolveReportLang(issue.lang ?? issue.payload?.lang)
  const dict = reportSheetDict(lang)

  return (
    <main lang={HTML_LANG[lang]} className="ga-scope min-h-screen bg-ga-bg py-8 print:bg-white print:py-0">
      {/*
        Bản in của phiếu là A4 DỌC, khác mặc định A4 ngang của globals.css (vốn dựng cho sổ điểm nhiều
        cột). `@page` không nhận selector nên không thể đặt theo lớp CSS — khai lại ngay trong tài liệu
        của chính route này là cách duy nhất chỉ đổi trang này mà không đụng bản in của các màn khác.
        `.print-area.print-flow` là hợp đồng sẵn có của globals.css: ẩn mọi thứ ngoài vùng in, và bỏ lớp
        phủ `position: fixed` để phiếu dài hơn một trang được chia trang thay vì bị cắt.
      */}
      <style>{'@media print { @page { size: A4 portrait; margin: 14mm; } }'}</style>

      <div className="print-area print-flow mx-auto max-w-[860px] px-4 sm:px-6">
        <ReportSheet
          dict={dict}
          lang={lang}
          payload={issue.payload}
          header={{
            orgName: issue.orgName,
            orgLogoUrl: issue.orgLogoUrl,
            studentName: issue.studentName,
            issuedByName: issue.issuedByName,
            verificationCode: issue.verificationCode,
            issuedAt: issue.issuedAt,
            tokenExpiresAt: issue.tokenExpiresAt,
            // Địa chỉ xác thực in lên giấy (§3.3 mục 10): người cầm bản in mở lại được đúng phiếu này.
            // Không lộ thêm gì — ai cầm tờ giấy đã cầm trọn nội dung phiếu.
            verifyUrl: absoluteUrl(`/phieu/${params.token}?lang=${lang}`),
          }}
        />
      </div>

      <PrintButton label={dict.printButton} hint={dict.printHint} />
    </main>
  )
}
