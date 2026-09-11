'use client'

/**
 * Nút In của trang phiếu công khai.
 *
 * CHỈ có In — KHÔNG có nút tải PDF (thiết kế §5 mặc định, owner chốt 10/09): bản PDF do trung tâm tải
 * từ màn giáo viên rồi tự gửi, nên đường công khai không cần và không nên phát file đi.
 *
 * `print:hidden` để chính nút này không in lên giấy.
 */
export function PrintButton({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-1.5 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center border border-ga-ink bg-ga-ink px-5 py-2.5 text-[13.5px] font-semibold text-ga-card transition-opacity hover:opacity-85"
      >
        {label}
      </button>
      <p className="ga-ui m-0 text-[12px] text-ga-muted">{hint}</p>
    </div>
  )
}
