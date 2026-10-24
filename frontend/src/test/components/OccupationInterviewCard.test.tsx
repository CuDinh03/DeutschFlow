/**
 * K3b (21/10/2026): thẻ "Phỏng vấn theo nghề của bạn" tạo phiên INTERVIEW kèm `occupationCode`, để
 * backend chọn người phỏng vấn + vị trí theo nghề — trước K3b không client nào gửi mã nghề.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import type { OccupationDetail } from '@/lib/occupationTypes'

const detailMock = vi.fn()
const createSessionMock = vi.fn()
const pushMock = vi.fn()
const loadMock = vi.fn()

vi.mock('@/lib/occupationApi', () => ({
  occupationApi: { detail: (code: string) => detailMock(code) },
}))
vi.mock('@/lib/aiSpeakingApi', () => ({
  aiSpeakingApi: { createSession: (...args: unknown[]) => createSessionMock(...args) },
}))
vi.mock('@/lib/speakingSessionBootstrap', () => ({
  loadSpeakingSessionIntoStore: (arg: unknown) => loadMock(arg),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock('@/components/speaking/SpeakingPersonaMiniAvatar', () => ({
  SpeakingPersonaMiniAvatar: ({ personaId }: { personaId: string }) => <span data-testid="avatar">{personaId}</span>,
}))

import { OccupationInterviewCard } from '@/components/features/ai-speaking/OccupationInterviewCard'

const DETAIL: OccupationDetail = {
  occupation: {
    code: 'altenpfleger', nameDe: 'Altenpfleger/in', nameEn: 'Geriatric nurse',
    nameVi: 'Điều dưỡng chăm sóc người cao tuổi', workplace: 'pflege', aliases: [], questionSet: 'GENERAL',
  },
  personaCode: 'KRUEGER',
  interviewPosition: 'Altenpfleger/in',
  sampleQuestions: [],
  reviewed: false,
  occupationQuestions: [],
  terms: [],
}

function renderCard(quotaBlocked = false) {
  const messages = { v2: studentVi, speaking: { errorQuota: 'Hết lượt' } } as unknown as AbstractIntlMessages
  return render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <OccupationInterviewCard occupationCode="altenpfleger" cefrLevel="B1" chatHref="/v2/student/speaking/live" quotaBlocked={quotaBlocked} />
    </NextIntlClientProvider>,
  )
}

describe('OccupationInterviewCard', () => {
  beforeEach(() => {
    detailMock.mockReset()
    createSessionMock.mockReset()
    pushMock.mockReset()
    loadMock.mockReset()
  })

  it('hiện nghề và người phỏng vấn theo nơi làm việc', async () => {
    detailMock.mockResolvedValue(DETAIL)
    renderCard()
    expect(await screen.findByText('Altenpfleger/in')).toBeInTheDocument()
    expect(screen.getByText('Người phỏng vấn: Frau Krüger')).toBeInTheDocument()
    expect(screen.getByTestId('avatar')).toHaveTextContent('KRUEGER')
  })

  it('bắt đầu ⇒ phiên INTERVIEW gửi occupationCode, KHÔNG gửi persona; vào phiên với Frau Krüger', async () => {
    detailMock.mockResolvedValue(DETAIL)
    createSessionMock.mockResolvedValue({
      data: { id: 7, persona: 'KRUEGER', interviewPosition: 'Altenpfleger/in', responseSchema: 'V1', initialAiMessage: null },
    })
    renderCard()
    fireEvent.click(await screen.findByRole('radio', { name: '3 năm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu phỏng vấn' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/v2/student/speaking/live'))
    const args = createSessionMock.mock.calls[0]
    expect(args[2]).toBeUndefined() // persona: backend chọn theo nghề
    expect(args[4]).toBe('INTERVIEW')
    expect(args[6]).toBe('3Y')
    expect(args[8]).toBe('altenpfleger')
    expect(loadMock.mock.calls[0][0]).toMatchObject({
      sessionMode: 'INTERVIEW',
      experienceLevel: '3Y',
      companion: { id: 'krueger', name: 'Frau Krüger', voiceId: 'KRUEGER' },
    })
  })

  it('hết lượt ⇒ không tạo phiên', async () => {
    detailMock.mockResolvedValue(DETAIL)
    renderCard(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu phỏng vấn' }))
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('nghề không tải được ⇒ không hiện thẻ', async () => {
    detailMock.mockRejectedValue(new Error('404'))
    const { container } = renderCard()
    await waitFor(() => expect(detailMock).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
