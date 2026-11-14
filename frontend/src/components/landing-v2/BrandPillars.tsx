'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

type PillarItem = { title: string; sub: string }

function PillarIcon({ index }: { index: number }) {
  switch (index) {
    case 0:
      // Mũ tốt nghiệp (Hiệu quả · Học thông minh)
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M4.5 14.5L18 8L31.5 14.5L18 21L4.5 14.5Z"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 17.5V24C10.5 26.2 13.9 28 18 28C22.1 28 25.5 26.2 25.5 24V17.5"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M30 15.2V22.5" stroke="var(--ga-brand-ink)" strokeWidth="2.1" strokeLinecap="round" />
          <rect x="28.2" y="22" width="3.6" height="3.6" rx="0.8" fill="var(--ga-brand-yellow)" />
        </svg>
      )
    case 1:
      // Tên lửa bứt phá (Tiến bộ · Mỗi ngày)
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M27.5 8.5C22.8 8.9 17.8 11.7 14.3 15.2L11.5 18L18 24.5L20.8 21.7C24.3 18.2 27.1 13.2 27.5 8.5Z"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M14.2 15.3L9.5 15.8L7.5 18.5L11.5 18"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20.7 21.8L20.2 26.5L17.5 28.5L18 24.5"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="21.2" cy="14.8" r="2.2" fill="var(--ga-brand-yellow)" />
          <path
            d="M11.2 22.2L7.2 26.2M13.8 24.8L10.5 28.1M8.8 19.8L6.3 22.3"
            stroke="var(--ga-brand-red)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 2:
      // Bong bóng hội thoại (Giao tiếp · Tự tin hơn)
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M18 7.5C11.1 7.5 5.5 12.1 5.5 17.8C5.5 20.6 6.9 23.2 9.2 25L7.8 29.2L13 27.3C14.6 27.8 16.3 28.1 18 28.1C24.9 28.1 30.5 23.5 30.5 17.8C30.5 12.1 24.9 7.5 18 7.5Z"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M13 16.2H23M13 20H19.5"
            stroke="var(--ga-brand-red)"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      )
    default:
      // Cặp hồ sơ nghề nghiệp (Kết nối · Cơ hội tại Đức)
      return (
        <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0" fill="none" aria-hidden="true">
          <rect
            x="5.5"
            y="12"
            width="25"
            height="17.5"
            rx="3"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
          />
          <path
            d="M13.5 12V9.5C13.5 8.4 14.4 7.5 15.5 7.5H20.5C21.6 7.5 22.5 8.4 22.5 9.5V12"
            stroke="var(--ga-brand-ink)"
            strokeWidth="2.1"
          />
          <path d="M5.5 19.2H30.5" stroke="var(--ga-brand-ink)" strokeWidth="1.9" />
          <rect x="15.5" y="17" width="5" height="4.4" rx="1" fill="var(--ga-brand-yellow)" />
        </svg>
      )
  }
}

/**
 * Dải 4 trụ cột thương hiệu chính thức từ Bảng Nhận Diện myDeutschFlow v3.4:
 * Hiệu quả · Tiến bộ · Giao tiếp · Kết nối.
 * Trên mobile 390px xếp gọn lưới 2x2 trong 1 nhịp nhìn; từ lg trải ngang 4 cột có vạch chia mảnh.
 */
export function BrandPillars() {
  const t = useTranslations('v2.landing.pillars')
  const items = t.raw('items') as PillarItem[]

  return (
    <div
      data-testid="brand-pillars"
      className="rounded-ga-lg border border-ga-border bg-ga-card px-4 py-4 shadow-ga-sm sm:px-6 sm:py-5"
    >
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-0">
        {items.map((item, idx) => (
          <li
            key={item.title}
            className={`flex items-center gap-3 ${idx > 0 ? 'lg:border-l lg:border-ga-border lg:pl-6' : ''} ${idx < items.length - 1 ? 'lg:pr-6' : ''}`}
          >
            <PillarIcon index={idx} />
            <div className="min-w-0">
              <div className="truncate text-ga-body font-bold text-ga-ink">{item.title}</div>
              <div className="truncate text-ga-caption text-ga-muted">{item.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
