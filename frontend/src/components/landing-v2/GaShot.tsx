import * as React from 'react'
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
}

/**
 * Khung ảnh chụp sản phẩm trên trang chủ — thanh nhãn 1px + vạch nhấn, đúng ngữ pháp Galerie
 * (viền 1px, góc vuông, chữ hoa giãn) thay vì đổ bóng kiểu "ảnh trong trình duyệt giả".
 *
 * Ảnh KHÔNG có `shadow`/`rounded` arbitrary: `scripts/lint-design-tokens.mjs` chốt debt theo
 * (file, rule, identity, count) nên mọi giá trị mới đều làm đỏ CI.
 */
export function GaShot({ name, caption, alt, accent, sizes }: GaShotProps) {
  const t = useTranslations('v2.landing')
  const locale = useLocale()
  const img = shotFor(name, locale)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = React.useState(false)

  /**
   * Vùng cuộn phải tới được bằng bàn phím (WCAG 2.1.1) — nhưng CHỈ khi nó thật sự cuộn được.
   * `tabIndex` là thuộc tính DOM, không có biến thể theo breakpoint: đặt cứng `0` thì ở ≥768px,
   * nơi ảnh đã vừa khít và không còn gì để cuộn, trang chủ có thêm bốn điểm dừng tab chết —
   * người dùng bàn phím dừng lại trên một <div> không bấm được, không cuộn được.
   *
   * Đo bề rộng thật thay vì đoán theo breakpoint: điều kiện thật là `scrollWidth > clientWidth`,
   * và nó còn đổi theo cỡ chữ của người dùng lẫn lúc xoay máy. Đo sau khi mount nên không lệch
   * hydration (máy chủ không biết bề rộng khung).
   */
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    // `min-w-0`: ô của lưới/flex mặc định là `min-width:auto` nên KHÔNG chịu hẹp hơn nội dung —
    // ảnh 720px bên trong kéo cả khung phình ra 720px, rồi `overflow-x-clip` ở thân trang CẮT CỤT
    // phần thừa thay vì cho cuộn. Đo ở khổ 390px trước khi sửa: khung rộng 742px, nửa phải của hai
    // ảnh trong lưới không tài nào xem được.
    <figure className="m-0 min-w-0 border border-ga-border bg-ga-card">
      <div className="h-[3px]" style={{ background: accent }} />
      {/* figcaption chỉ chứa NHÃN: nó là tên khả truy cập của cả figure, nhét chỉ dẫn thao tác vào
          đây thì trình đọc màn hình đọc "…Sổ điểm lớp K30 Cuộn ngang để xem tiếp" thành một cụm. */}
      <figcaption className="flex items-center gap-2.5 border-b border-ga-border px-4 py-3 sm:px-5">
        <span className="inline-block h-[7px] w-[7px] shrink-0" style={{ background: accent }} />
        <GaCap>{caption}</GaCap>
      </figcaption>
      {/*
        Khổ hẹp: ảnh chụp màn 1440px mà ép xuống ~350px thì chữ thành vệt mờ — tệ hơn là không có
        ảnh. Nên dưới `md` ảnh giữ bề ngang tối thiểu 720px và CUỘN NGANG trong khung; từ `md` trở
        lên khung đủ rộng, ảnh trở lại vừa khít và hết cuộn.
        Chỉ khung này cuộn — thân trang không bao giờ tràn ngang.
      */}
      <div
        ref={viewportRef}
        tabIndex={scrollable ? 0 : undefined}
        className="overflow-x-auto md:overflow-x-visible"
      >
        {/* Ảnh mang sẵn kích thước thật (import tĩnh) nên ô giữ chỗ đúng tỉ lệ từ đầu — không nhảy layout. */}
        <Image src={img} alt={alt} sizes={sizes} className="block h-auto w-full min-w-[720px] md:min-w-0" />
      </div>
      {/* Chỉ dẫn nằm NGOÀI figcaption và chỉ hiện khi thật sự còn phần khuất. `text-ga-muted` chứ
          không phải `text-ga-subtle`: đây là chỉ dẫn mang nghĩa, mà --ga-subtle chỉ đạt 2,2:1 trên
          nền thẻ — dưới ngưỡng WCAG 1.4.3 AA và bị chính DEUTSCHFLOW_DESIGN_SYSTEM.md §5.1 cấm. */}
      {scrollable && (
        <p className="m-0 border-t border-ga-border px-4 py-2 text-ga-caption text-ga-muted sm:px-5">
          {t('shotScrollHint')}
        </p>
      )}
    </figure>
  )
}
