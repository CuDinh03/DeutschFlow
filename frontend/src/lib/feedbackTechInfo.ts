import { scrubUrl } from '@/lib/analytics/scrubUrl'
import type { FeedbackTechInfo } from '@/lib/feedbackApi'

/**
 * Thông tin kỹ thuật kèm góp ý (BR-04): CHỈ đường dẫn đã lọc token, trình duyệt + bản chính, hệ điều
 * hành + bản chính, loại thiết bị, ngôn ngữ, cỡ màn hình làm tròn 100 px. Không chuỗi User-Agent đầy
 * đủ, không IP, không nội dung trang. Người dùng xem trước đúng các trường này ("Xem sẽ gửi gì").
 */
export function collectTechInfo(pagePath: string, locale: string, ua: string, width: number, height: number): FeedbackTechInfo {
  const path = scrubUrl(pagePath).split('?')[0].split('#')[0]
  return {
    page: path.slice(0, 200),
    browser: browserOf(ua),
    os: osOf(ua),
    device: deviceOf(ua, width),
    locale,
    screen: `${round100(width)}x${round100(height)}`,
  }
}

function round100(n: number): number {
  return Math.max(100, Math.round(n / 100) * 100)
}

function major(ua: string, re: RegExp): string {
  const m = ua.match(re)
  return m ? m[1].split(/[._]/)[0] : ''
}

export function browserOf(ua: string): string {
  if (/Edg\//.test(ua)) return `Edge ${major(ua, /Edg\/([\d.]+)/)}`.trim()
  if (/OPR\//.test(ua)) return `Opera ${major(ua, /OPR\/([\d.]+)/)}`.trim()
  if (/Firefox\//.test(ua)) return `Firefox ${major(ua, /Firefox\/([\d.]+)/)}`.trim()
  if (/CriOS\//.test(ua)) return `Chrome ${major(ua, /CriOS\/([\d.]+)/)}`.trim()
  if (/Chrome\//.test(ua)) return `Chrome ${major(ua, /Chrome\/([\d.]+)/)}`.trim()
  if (/Safari\//.test(ua)) return `Safari ${major(ua, /Version\/([\d.]+)/)}`.trim()
  return 'Khác'
}

export function osOf(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return `iOS ${major(ua, /OS (\d+[_\d]*)/)}`.trim()
  if (/Android/.test(ua)) return `Android ${major(ua, /Android ([\d.]+)/)}`.trim()
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Khác'
}

export function deviceOf(ua: string, width: number): 'phone' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return 'tablet'
  if (/iPhone|iPod|Mobile/.test(ua) || width < 600) return 'phone'
  return 'desktop'
}
