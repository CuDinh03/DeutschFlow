import {
  LayoutDashboard,
  Map,
  Mic,
  Brain,
  Search,
  GitBranch,
  Trophy,
  Flame,
  type LucideIcon,
} from 'lucide-react-native'
import type { Theme } from '@/lib/theme'

export type GuideTone = 'accent' | 'brand' | 'info' | 'success'

// Routes are the explicit student paths so they satisfy expo-router's Href type
// without a cast.
export type StudentRoute =
  | '/(student)'
  | '/(student)/roadmap'
  | '/(student)/speaking'
  | '/(student)/srs'
  | '/(student)/vocabulary'
  | '/(student)/learn'
  | '/(student)/exam'
  | '/(student)/stats'

export interface GuideItem {
  /** Stable analytics id (mirrors web guide feature keys). */
  key: string
  icon: LucideIcon
  tone: GuideTone
  title: string
  desc: string
  how: string
  route: StudentRoute
}

/** Resolve a tone to its foreground + soft-background colours for the theme. */
export function toneStyles(theme: Theme, tone: GuideTone): { fg: string; soft: string } {
  const map: Record<GuideTone, { fg: string; soft: string }> = {
    accent: { fg: theme.colors.accent, soft: theme.colors.accentSoft },
    brand: { fg: theme.colors.brand, soft: theme.colors.brandSoft },
    info: { fg: theme.colors.info, soft: theme.colors.infoSoft },
    success: { fg: theme.colors.success, soft: theme.colors.successSoft },
  }
  return map[tone]
}

/** Full feature catalogue shown on the always-available guide screen. */
export const GUIDE_ITEMS: readonly GuideItem[] = [
  {
    key: 'dashboard',
    icon: LayoutDashboard,
    tone: 'success',
    title: 'Trang chủ',
    desc: 'Nơi tổng hợp việc cần làm hôm nay: chuỗi ngày học, XP, ôn tập đến hạn và các hoạt động chính.',
    how: 'Mở app là vào ngay Trang chủ. Bấm vào thẻ hoạt động để bắt đầu học.',
    route: '/(student)',
  },
  {
    key: 'roadmap',
    icon: Map,
    tone: 'accent',
    title: 'Lộ trình học',
    desc: 'Bản đồ kỹ năng cá nhân hoá từ A1 đến B2. Mỗi chặng mở khoá khi bạn hoàn thành chặng trước.',
    how: 'Vào Lộ trình và chọn chặng đang sáng để học bài tiếp theo.',
    route: '/(student)/roadmap',
  },
  {
    key: 'speaking',
    icon: Mic,
    tone: 'info',
    title: 'Nói với AI',
    desc: 'Luyện hội thoại tiếng Đức với gia sư AI theo đúng trình độ. AI sửa lỗi và chấm điểm sau mỗi buổi nói.',
    how: 'Bấm "Nói với AI", chọn chủ đề rồi nói tự nhiên. Hãy cho phép micro khi được hỏi.',
    route: '/(student)/speaking',
  },
  {
    key: 'review',
    icon: Brain,
    tone: 'brand',
    title: 'Ôn tập (SRS)',
    desc: 'Hệ thống lặp lại ngắt quãng nhắc bạn ôn từ vựng và ngữ pháp đúng lúc sắp quên, giúp nhớ lâu hơn.',
    how: 'Mỗi ngày mở "Ôn tập" và làm hết các thẻ đến hạn — chỉ vài phút là đủ.',
    route: '/(student)/srs',
  },
  {
    key: 'vocabulary',
    icon: Search,
    tone: 'info',
    title: 'Tra cứu từ vựng',
    desc: 'Tra nghĩa, mạo từ (der/die/das), ví dụ và phát âm của bất kỳ từ tiếng Đức nào.',
    how: 'Vào "Tra cứu từ vựng", gõ từ cần tìm và lưu lại để ôn sau.',
    route: '/(student)/vocabulary',
  },
  {
    key: 'learn',
    icon: GitBranch,
    tone: 'success',
    title: 'Cây kỹ năng',
    desc: 'Toàn bộ bài học theo chủ đề và kỹ năng, sắp xếp để bạn luyện tập có hệ thống.',
    how: 'Vào tab "Học" để xem cây kỹ năng và chọn bài muốn luyện.',
    route: '/(student)/learn',
  },
  {
    key: 'exam',
    icon: Trophy,
    tone: 'brand',
    title: 'Thi thử',
    desc: 'Bài thi mô phỏng định dạng Goethe/telc với đủ kỹ năng và chấm điểm chi tiết.',
    how: 'Khi sắp thi, vào "Thi thử" để làm một đề hoàn chỉnh và xem điểm từng phần.',
    route: '/(student)/exam',
  },
  {
    key: 'streak',
    icon: Flame,
    tone: 'accent',
    title: 'Chuỗi ngày & XP',
    desc: 'Học mỗi ngày để giữ chuỗi (streak), nhận XP, lên cấp và mở huy hiệu — động lực duy trì thói quen.',
    how: 'Hoàn thành ít nhất một hoạt động mỗi ngày để không mất chuỗi. Xem tiến trình trong Thống kê.',
    route: '/(student)/stats',
  },
] as const

export interface FaqEntry {
  q: string
  a: string
  /** Mentions the commercial PRO plan — filtered out on the iOS free build (App Store 2.1(b)). */
  proOnly?: boolean
}

export const FAQ: readonly FaqEntry[] = [
  {
    q: 'Mỗi ngày nên học bao lâu?',
    a: 'Chỉ cần 15–20 phút đều đặn mỗi ngày là đủ để tiến bộ. Quan trọng nhất là giữ chuỗi ngày học.',
  },
  {
    q: 'Nên bắt đầu từ đâu?',
    a: 'Hãy theo "Lộ trình học" và mỗi ngày làm chặng đang sáng. Trang chủ cũng luôn gợi ý hoạt động phù hợp.',
  },
  {
    q: 'Nói với AI có cần micro không?',
    a: 'Có. Lần đầu app sẽ xin quyền truy cập micro. Bạn cũng có thể gõ chữ nếu chưa muốn nói.',
  },
  {
    q: 'Ôn tập (SRS) hoạt động thế nào?',
    a: 'Hệ thống tự nhắc bạn ôn lại từ và ngữ pháp đúng lúc sắp quên, nên bạn nhớ lâu hơn mà tốn ít thời gian hơn.',
  },
  {
    q: 'Làm sao để mở khoá mọi tính năng?',
    a: 'Một số tính năng nâng cao thuộc gói PRO. Vào mục Nâng cấp PRO trong Hồ sơ để xem chi tiết.',
    proOnly: true,
  },
] as const
