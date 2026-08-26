/**
 * Wave 1 / S-02 + S-03 — hợp đồng hiển thị của các learning component mới.
 *
 * Trọng tâm: ContinueLearning là CTA filled DUY NHẤT và không được trỏ bừa khi hết bài;
 * trạng thái node không truyền chỉ bằng màu; node khoá phải nói ĐIỀU KIỆN MỞ bằng câu chữ.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ContinueLearning } from '@/components/learning/ContinueLearning'
import { TodayList, type TodayTask } from '@/components/learning/TodayList'
import { HabitStrip } from '@/components/learning/HabitStrip'
import { NodeList } from '@/components/learning/NodeList'
import { JourneyPreview } from '@/components/learning/JourneyPreview'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const f = (k: string, v?: Record<string, unknown>) => (v ? `${k}:${Object.values(v).join(',')}` : k)
    ;(f as unknown as { has: (k: string) => boolean }).has = () => false
    return f
  },
}))

function node(p: Partial<RoadmapNode> & { id: number }): RoadmapNode {
  return {
    code: `n${p.id}`,
    title: `Kapitel ${p.id}`,
    subtitle: `Chặng ${p.id}`,
    emoji: '📘',
    state: 'current',
    xpReward: 10,
    lessonsTotal: 4,
    lessonsCompleted: 1,
    cefrLevel: 'B1',
    description: '',
    ...p,
  } as RoadmapNode
}

describe('ContinueLearning (S-02)', () => {
  it('hiện chương đang học, tiến độ đọc được và CTA trỏ đúng bài', () => {
    render(<ContinueLearning node={node({ id: 8, lessonsCompleted: 3, lessonsTotal: 4 })} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Chặng 8')
    // Tiêu đề Đức đi kèm, đánh dấu ngôn ngữ cho screen reader / hyphenation.
    expect(screen.getByText('Kapitel 8').getAttribute('lang')).toBe('de')
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('75')
    expect(screen.getByText('75%')).toBeInTheDocument()
    const cta = screen.getByRole('link')
    expect(cta.getAttribute('href')).toBe('/v2/student/learn/8')
    // Nhãn có ngữ cảnh chương, không chỉ "Tiếp tục".
    expect(cta.getAttribute('aria-label')).toContain('Chặng 8')
  })

  it('ĐÚNG MỘT CTA filled trong khối', () => {
    const { container } = render(<ContinueLearning node={node({ id: 1 })} />)
    expect(container.querySelectorAll('.bg-ga-accent')).toHaveLength(1)
  })

  it('học viên mới → CTA vào buổi học đầu tiên, không trỏ bài ngẫu nhiên', () => {
    render(<ContinueLearning isFirstSession node={node({ id: 5 })} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/v2/student/beginner')
  })

  it('hết bài để học tiếp → nói đúng trạng thái và dẫn về lộ trình', () => {
    render(<ContinueLearning node={undefined} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/v2/student/roadmap')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('doneTitle')
  })
})

describe('TodayList (S-02)', () => {
  const tasks: TodayTask[] = [
    { id: 'srs', icon: 'srs', label: 'Ôn từ', meta: '5 việc', href: '/v2/student/review' },
    { id: 'speaking', icon: 'speaking', label: 'Luyện nói', href: '/v2/student/speaking' },
  ]

  it('render danh sách semantic, mỗi việc là một link ≥44px', () => {
    render(<TodayList tasks={tasks} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const l of links) expect(l.className).toContain('min-h-11')
  })

  it('trần 4 việc — phần dư không đổ hết vào Heute', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...tasks[0], id: `t${i}` }))
    render(<TodayList tasks={many} />)
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('không có việc → nói rõ, không hiện danh sách rỗng', () => {
    render(<TodayList tasks={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('empty')).toBeInTheDocument()
  })
})

describe('HabitStrip (S-02) — gamification đúng thứ bậc', () => {
  it('không có nguồn dữ liệu nào → không render (không hiện 0 giả)', () => {
    const { container } = render(<HabitStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('streak và XP hiển thị dạng compact, XP là link tới thành tích', () => {
    render(<HabitStrip streakDays={4} xp={{ level: 3, progressInLevel: 20, xpNeededForNext: 80 }} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/v2/student/achievements')
  })
})

describe('NodeList (S-03) — mật độ giảm, trạng thái đọc được', () => {
  const nodes = [
    node({ id: 1, progressStatus: 'COMPLETED' }),
    node({ id: 2, progressStatus: 'IN_PROGRESS' }),
    node({ id: 3, progressStatus: 'LOCKED' }),
  ]

  it('mỗi node có ĐÚNG 1 badge trạng thái và tối đa 1 CTA chính', () => {
    const { container } = render(<NodeList nodes={nodes} />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
    // node đang học: 1 badge + 1 nút filled (bg-ga-accent) + 1 link phụ
    const inProgress = items[1]
    expect(inProgress.querySelectorAll('.bg-ga-accent')).toHaveLength(1)
  })

  it('node khoá nói ĐIỀU KIỆN MỞ bằng câu chữ và không có CTA học', () => {
    const { container } = render(<NodeList nodes={nodes} />)
    const locked = container.querySelectorAll('li')[2]
    expect(locked.textContent).toContain('nodeLockedBy:Chặng 2')
    expect(locked.querySelector('a')).toBeNull()
  })

  it('trạng thái có NHÃN CHỮ, không chỉ màu/icon', () => {
    render(<NodeList nodes={nodes} />)
    expect(screen.getByText('nodeStatus.completed')).toBeInTheDocument()
    expect(screen.getByText('nodeStatus.inProgress')).toBeInTheDocument()
    expect(screen.getByText('nodeStatus.locked')).toBeInTheDocument()
  })
})

describe('JourneyPreview (S-02/S-03)', () => {
  const nodes = [1, 2, 3, 4].map((i) =>
    node({ id: i, weekNumber: 1, dayNumber: i, progressStatus: i === 1 ? 'COMPLETED' : i === 2 ? 'IN_PROGRESS' : 'LOCKED' }),
  )

  it('mở đầu bằng node đang học và đánh dấu là bước hiện tại', () => {
    render(<JourneyPreview nodes={nodes} />)
    const current = screen.getByRole('link', { current: 'step' })
    expect(current.getAttribute('href')).toBe('/v2/student/learn/2')
  })

  it('node khoá dẫn về lộ trình chứ không vào thẳng bài', () => {
    render(<JourneyPreview nodes={nodes} />)
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/v2/student/roadmap')
  })

  it('lộ trình rỗng → không render', () => {
    const { container } = render(<JourneyPreview nodes={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
