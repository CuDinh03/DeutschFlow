/**
 * Chip gợi ý persona theo chủ đề (phương án B — BAO_CAO_KIEM_TRA_PERSONA_2026-08-06 §6.2):
 * chủ đề chuyên ngành lệch persona → chip mềm dưới ô chủ đề, bấm là đổi persona,
 * tắt được, và KHÔNG hiện khi chủ đề trung tính. next-intl mock trả key (parity test hiện có).
 */
import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WelcomeScreen } from '@/components/speaking/WelcomeScreen'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => (props: Record<string, unknown>) => {
      const { children, whileHover, whileTap, animate, transition, ...rest } = props as {
        children?: React.ReactNode
      } & Record<string, unknown>
      return <div {...(rest as object)}>{children}</div>
    },
  }),
}))

function renderWelcome() {
  return render(
    <WelcomeScreen
      onStart={() => {}}
      isStarting={false}
      initialTopic={null}
      initialCefr={null}
      initialSessionMode={null}
      planCurrentLevel="A2"
      planTargetLevel="B1"
      industry={null}
    />,
  )
}

function goToStep2() {
  fireEvent.click(screen.getByText('continueToSettings'))
}

describe('WelcomeScreen — chip gợi ý persona theo chủ đề', () => {
  test('chủ đề y khoa tự nhập → hiện chip, bấm chip đổi persona', () => {
    renderWelcome()
    goToStep2()
    fireEvent.change(screen.getByPlaceholderText('customTopicPlaceholder'), {
      target: { value: 'Beim Arzt' },
    })
    expect(screen.getByText(/personaTopicHint$/)).toBeTruthy()

    fireEvent.click(screen.getByText(/personaNameSarah/))
    // Persona badge ở nút start đổi theo → không còn hint (SARAH đúng ngành medizin)
    expect(screen.queryByText(/personaTopicHint$/)).toBeNull()
  })

  test('chủ đề trung tính → không hiện chip', () => {
    renderWelcome()
    goToStep2()
    fireEvent.change(screen.getByPlaceholderText('customTopicPlaceholder'), {
      target: { value: 'Wochenende' },
    })
    expect(screen.queryByText(/personaTopicHint$/)).toBeNull()
  })

  test('nút tắt ẩn chip cho chủ đề hiện tại', () => {
    renderWelcome()
    goToStep2()
    fireEvent.change(screen.getByPlaceholderText('customTopicPlaceholder'), {
      target: { value: 'Beim Arzt' },
    })
    fireEvent.click(screen.getByLabelText('personaTopicHintDismiss'))
    expect(screen.queryByText(/personaTopicHint$/)).toBeNull()
    // Đổi sang chủ đề ngành khác → chip hiện lại
    fireEvent.change(screen.getByPlaceholderText('customTopicPlaceholder'), {
      target: { value: 'Hotel Check-in' },
    })
    expect(screen.getByText(/personaTopicHint$/)).toBeTruthy()
  })
})
