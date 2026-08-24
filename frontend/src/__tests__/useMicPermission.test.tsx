import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useMicPermission } from '@/hooks/useMicPermission'

function Probe() {
  const state = useMicPermission()
  return <span data-testid="state">{state}</span>
}

type Listener = () => void

function mockPermissions(initial: string) {
  const listeners: Listener[] = []
  const status = {
    state: initial,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue(status) },
  })
  return {
    setState(next: string) {
      status.state = next
      listeners.forEach((fn) => fn())
    },
  }
}

afterEach(() => {
  // jsdom mặc định không có navigator.permissions — trả về trạng thái đó sau mỗi test.
  delete (navigator as unknown as Record<string, unknown>).permissions
})

describe('useMicPermission', () => {
  it('đọc trạng thái ban đầu từ Permissions API', async () => {
    mockPermissions('denied')
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('denied'))
  })

  it('tự cập nhật khi người dùng cấp quyền (onchange) — không cần reload', async () => {
    const ctl = mockPermissions('denied')
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('denied'))
    act(() => ctl.setState('granted'))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('granted'))
  })

  it("trình duyệt không hỗ trợ query('microphone') → 'unknown' (không chặn UI)", async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: vi.fn().mockRejectedValue(new TypeError('unsupported')) },
    })
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('unknown'))
  })
})
