import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { GaCap } from '@/components/ui-v2'
import { shotFor, type ShotName } from './landingShots'

export interface GaShotProps {
  /** Màn cần hiển thị; ảnh tự chọn theo locale đang xem (xem landingShots). */
  name: ShotName
  /** Nhãn trên thanh tiêu đề — nói ảnh này là màn nào của sản phẩm. */
  caption: string
  /** Mô tả cho trình đọc màn hình: nói NỘI DUNG ảnh, không lặp lại caption. */
  alt: string
  /** Màu vạch nhấn trên đỉnh khung — dùng biến --ga-* của section chứa nó. */
  accent: string
  /** Bề rộng ô ảnh theo từng khổ màn, cho next/image chọn đúng cỡ tải về. */
  sizes: string
  /** Ảnh đầu tiên dưới màn hình đầu có thể ưu tiên; mặc định lazy (đều nằm dưới nếp gấp). */
  priority?: boolean
}

/**
 * Khung ảnh chụp sản phẩm trên trang chủ — thanh nhãn 1px + vạch nhấn, đúng ngữ pháp Galerie
 * (viền 1px, góc vuông, chữ hoa giãn) thay vì đổ bóng kiểu "ảnh trong trình duyệt giả".
 *
 * Ảnh KHÔNG có `shadow`/`rounded` arbitrary: `scripts/lint-design-tokens.mjs` chốt debt theo
 * (file, rule, identity, count) nên mọi giá trị mới đều làm đỏ CI.
 */
export function GaShot({ name, caption, alt, accent, sizes, priority = false }: GaShotProps) {
  const t = useTranslations('v2.landing')
  const locale = useLocale()
  const img = shotFor(name, locale)

  // `min-w-0` trên <figure>: ô của lưới/flex mặc định là `min-width:auto` nên KHÔNG chịu hẹp hơn
  // nội dung — ảnh 720px bên trong kéo cả khung phình ra 720px, rồi `overflow-x-clip` ở thân trang
  // CẮT CỤT phần thừa thay vì cho cuộn. Đo ở khổ 390px trước khi sửa: khung rộng 742px, nửa phải
  // của hai ảnh trong lưới không tài nào xem được.
  return (
    <figure className="m-0 min-w-0 border border-ga-border bg-ga-card">
      <div className="h-[3px]" style={{ background: accent }} />
      <figcaption className="flex items-center gap-2.5 border-b border-ga-border px-4 py-3 sm:px-5">
        <span className="inline-block h-[7px] w-[7px] shrink-0" style={{ background: accent }} />
        <GaCap>{caption}</GaCap>
        <span className="ml-auto shrink-0 text-ga-caption text-ga-subtle md:hidden">{t('shotScrollHint')}</span>
      </figcaption>
      {/*
        Khổ hẹp: ảnh chụp màn 1440px mà ép xuống ~350px thì chữ thành vệt mờ — tệ hơn là không có
        ảnh. Nên dưới `md` ảnh giữ bề ngang tối thiểu 720px và CUỘN NGANG trong khung để vuốt đọc
        được; từ `md` trở lên khung đủ rộng, ảnh trở lại vừa khít và hết cuộn.
        Chỉ khung này cuộn — thân trang không bao giờ tràn ngang.
      */}
      {/* tabIndex: vùng cuộn phải tới được bằng bàn phím, nếu không người không dùng chuột/chạm
          không bao giờ xem được nửa phải của ảnh (WCAG 2.1.1). */}
      <div tabIndex={0} className="overflow-x-auto md:overflow-x-visible">
        {/* Ảnh mang sẵn kích thước thật (import tĩnh) nên ô giữ chỗ đúng tỉ lệ từ đầu — không nhảy layout. */}
        <Image src={img} alt={alt} sizes={sizes} priority={priority} className="block h-auto w-full min-w-[720px] md:min-w-0" />
      </div>
    </figure>
  )
}
