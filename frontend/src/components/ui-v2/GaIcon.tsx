import * as React from 'react'
import {
  LayoutDashboard,
  Calendar,
  Users,
  ClipboardCheck,
  LineChart,
  Bell,
  SpellCheck,
  FileText,
  Image as ImageIcon,
  User,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Table,
  Inbox,
  CreditCard,
  Coins,
  Building2,
  Tag,
  BookOpen,
  Images,
  SlidersHorizontal,
  Megaphone,
  Mic,
  MessagesSquare,
  ReceiptText,
  GraduationCap,
  BadgeCheck,
  Landmark,
  Receipt,
  Mail,
  ShieldCheck,
  Settings,
  LogOut,
  ListChecks,
  Presentation,
  Search,
  HelpCircle,
  Circle,
  PenLine,
  FileQuestion,
  TrendingUp,
  ClipboardList,
  Database,
  Repeat,
  PlayCircle,
  Route,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GaIcon — icon by stable name (names mirror the manifest's Material Symbols set,
 * resolved to lucide-react glyphs so there is no icon-font / CSP dependency).
 * Color inherits via currentColor; decorative by default.
 */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  calendar_month: Calendar,
  groups: Users,
  group: Users,
  grading: ClipboardCheck,
  monitoring: LineChart,
  notifications: Bell,
  spellcheck: SpellCheck,
  description: FileText,
  image: ImageIcon,
  person: User,
  chat: MessageSquare,
  group_add: UserPlus,
  error: AlertCircle,
  table_rows: Table,
  inbox: Inbox,
  payments: CreditCard,
  toll: Coins,
  corporate_fare: Building2,
  sell: Tag,
  menu_book: BookOpen,
  photo_library: Images,
  tune: SlidersHorizontal,
  campaign: Megaphone,
  record_voice_over: Mic,
  forum: MessagesSquare,
  receipt_long: ReceiptText,
  school: GraduationCap,
  badge: BadgeCheck,
  account_balance: Landmark,
  receipt: Receipt,
  mail: Mail,
  admin_panel_settings: ShieldCheck,
  settings: Settings,
  checklist: ListChecks,
  co_present: Presentation,
  search: Search,
  help: HelpCircle,
  logout: LogOut,
  draw: PenLine,
  quiz: FileQuestion,
  trending_up: TrendingUp,
  mic: Mic,
  assessment: ClipboardList,
  database: Database,
  repeat: Repeat,
  play_circle: PlayCircle,
  route: Route,
  emoji_events: Trophy,
}

export interface GaIconProps {
  name: string
  size?: number
  title?: string
  className?: string
}

export function GaIcon({ name, size = 18, title, className }: GaIconProps) {
  const Cmp = ICONS[name] ?? Circle
  return (
    <Cmp
      size={size}
      strokeWidth={1.9}
      className={cn('shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  )
}
