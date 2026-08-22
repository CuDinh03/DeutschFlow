'use client'

import '@/styles/practice-runner.css'

/**
 * Màn chờ "ươm mầm" — thay spinner chung khi `start`/`next` trả 202 và đề đang sinh nền.
 *
 * Nụ hoa lấy đúng hình `#rtBud` của cây (2 đài + 3 cánh khép + chấm vàng đầu nụ) để học viên nhận
 * ra "cái nụ trên cây của mình đang được ươm", không phải một loading bất kỳ. `role="status"` để
 * trình đọc màn hình (và e2e) bắt được trạng thái chờ một cách xác định.
 */
export function SeedlingWait({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="seedling-wait"
      className="flex flex-col items-center gap-3 rounded-ga border border-ga-line bg-ga-card px-6 py-8"
    >
      <svg viewBox="-36 -46 72 62" width="104" height="90" aria-hidden className="overflow-visible">
        <circle className="pr-seed-ring" r="27" cy="-14" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.5" />
        <circle className="pr-seed-ring pr-r2" r="27" cy="-14" fill="none" stroke="#e89b2c" strokeWidth="1.2" opacity="0.5" />
        <g className="pr-seed-bud" transform="translate(0 10) scale(1.9)">
          <path d="M-0.2 1.5 C -0.4 3.5, -0.8 5.5, -1.4 7.5" fill="none" stroke="#6E8F5A" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M-0.6 0.5 C -4.6 -0.4, -7.6 -3.6, -8.2 -8.4 C -4.8 -7.2, -1.9 -4.6, -0.3 -1.2 Z" fill="#7FAF77" stroke="#3A302A" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M0.7 0.5 C 4.9 -0.6, 7.8 -4.2, 8 -9.2 C 4.6 -7.7, 1.8 -4.8, 0.4 -1.2 Z" fill="#8EBF7A" stroke="#3A302A" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M-0.6 -2.6 C -4.8 -5.4, -6.6 -11, -5.4 -17.6 C -4.4 -19.8, -2.8 -21, -1.6 -20.6 C -2.6 -14.6, -2 -7.8, -0.6 -2.6 Z" fill="#ECDFC4" stroke="#3A302A" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M0.8 -2.8 C 5 -5.8, 6.6 -11.6, 5.2 -18 C 4.2 -20.2, 2.6 -21.2, 1.6 -20.8 C 2.6 -14.6, 1.9 -7.8, 0.8 -2.8 Z" fill="#F1E7D2" stroke="#3A302A" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M0 -1.8 C -3.4 -6.8, -3.9 -14.6, -0.4 -22.8 C 3.4 -15.2, 3.4 -7.2, 0 -1.8 Z" fill="#F3EAD3" stroke="#3A302A" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="-0.3" cy="-21.6" r="1.7" fill="#F4BE24" stroke="#C77F1F" strokeWidth="0.8" />
        </g>
      </svg>
      <p className="ga-ui text-[13.5px] font-medium text-ga-muted">{label}</p>
    </div>
  )
}
