import { useChatOutboxStore } from '@/stores/useChatOutboxStore'
import { messagesApi, type Message } from '@/lib/messagesApi'
import { classChannelApi, type ClassMessage } from '@/lib/classChannelApi'

// Let every queued attempt (a `void`-fired async chain) settle.
const settle = () => new Promise((r) => setTimeout(r, 0))

const serverMsg = (id: number, body: string): Message => ({
  id, senderId: 1, recipientId: 5, body, createdAt: '2026-07-05T10:00:00.000Z', readAt: null, mine: true,
})
const serverClassMsg = (id: number, body: string): ClassMessage => ({
  id, senderId: 1, senderName: 'Tôi', body, createdAt: '2026-07-05T10:00:00.000Z', mine: true, deleted: false, canDelete: true,
})

// Axios-shaped errors so the store's isTransientFailure() classifies them correctly.
const networkError = { isAxiosError: true, message: 'Network Error' }
const httpError = (status: number) => ({ isAxiosError: true, response: { status } })

describe('useChatOutboxStore', () => {
  beforeEach(() => {
    useChatOutboxStore.setState({ items: [] })
    jest.restoreAllMocks()
  })

  it('send → sending → confirmed(serverId) on ack, keeping the message as a shadow', async () => {
    const sendSpy = jest.spyOn(messagesApi, 'send').mockResolvedValue(serverMsg(100, 'hi'))
    useChatOutboxStore.getState().send('dm', 5, 'hi')

    // Optimistic immediately: one 'sending' item.
    let items = useChatOutboxStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'dm', targetId: 5, body: 'hi', status: 'sending' })

    await settle()
    items = useChatOutboxStore.getState().items
    expect(items).toHaveLength(1) // NOT removed — kept as a shadow so a late poll can't lose it
    expect(items[0]).toMatchObject({ status: 'confirmed', serverId: 100 })
    // tempId đi kèm làm idempotency key ngay từ lượt POST đầu (F-13 fix gốc), đúng format mới
    // có hậu tố ngẫu nhiên (chống trùng key giữa hai thiết bị cùng tài khoản).
    expect(sendSpy).toHaveBeenCalledWith(5, 'hi', items[0].tempId)
    expect(items[0].tempId).toMatch(/^tmp-\d+-\d+-[a-z0-9]+$/)
  })

  it('classifies a network failure as retryable and a 4xx as permanent', async () => {
    jest.spyOn(messagesApi, 'send').mockRejectedValueOnce(networkError)
    useChatOutboxStore.getState().send('dm', 5, 'offline')
    await settle()
    expect(useChatOutboxStore.getState().items[0]).toMatchObject({ status: 'failed', retryable: true })

    useChatOutboxStore.setState({ items: [] })
    jest.spyOn(messagesApi, 'send').mockRejectedValueOnce(httpError(403))
    useChatOutboxStore.getState().send('dm', 5, 'blocked')
    await settle()
    expect(useChatOutboxStore.getState().items[0]).toMatchObject({ status: 'failed', retryable: false })
  })

  it('flush retries a transient failure but never a permanent one or a confirmed shadow', async () => {
    // Seed: one transient-failed, one permanent-failed, one confirmed shadow.
    useChatOutboxStore.setState({
      items: [
        { tempId: 't-net', kind: 'dm', targetId: 5, body: 'a', createdAt: '1', status: 'failed', retryable: true },
        { tempId: 't-403', kind: 'dm', targetId: 5, body: 'b', createdAt: '2', status: 'failed', retryable: false },
        { tempId: 't-ok', kind: 'dm', targetId: 5, body: 'c', createdAt: '3', status: 'confirmed', serverId: 100 },
      ],
    })
    // F-13: retry giờ hỏi server trước (bước nghi vấn rẻ qua conversations) —
    // thread trống nghĩa là không có echo → vẫn phải RESEND như trước.
    jest.spyOn(messagesApi, 'conversations').mockResolvedValue([])
    const sendSpy = jest.spyOn(messagesApi, 'send').mockResolvedValue(serverMsg(200, 'a'))
    useChatOutboxStore.getState().flush()
    await settle()

    expect(sendSpy).toHaveBeenCalledTimes(1) // only the transient-failed 'a' re-attempted
    // Retry gửi lại CÙNG key (tempId của item) — server replay thay vì tạo tin trùng.
    expect(sendSpy).toHaveBeenCalledWith(5, 'a', 't-net')
    const items = useChatOutboxStore.getState().items
    expect(items.find((i) => i.tempId === 't-net')).toMatchObject({ status: 'confirmed', serverId: 200 })
    expect(items.find((i) => i.tempId === 't-403')).toMatchObject({ status: 'failed', retryable: false })
    expect(items.find((i) => i.tempId === 't-ok')).toMatchObject({ status: 'confirmed', serverId: 100 })
  })

  it('F-13 dm: retry thấy tin ĐÃ nằm trên server (POST timeout nhưng server lưu) → confirm bằng id thật, KHÔNG resend', async () => {
    const sentAt = '2026-09-02T10:00:00.000Z'
    useChatOutboxStore.setState({
      items: [
        { tempId: 't-echo', kind: 'dm', targetId: 5, body: 'hallo', createdAt: sentAt, status: 'failed', retryable: true },
      ],
    })
    jest.spyOn(messagesApi, 'conversations').mockResolvedValue([
      { userId: 5, displayName: 'GV', email: 'gv@x.de', lastMessage: 'hallo', lastAt: '2026-09-02T10:00:05.000Z', unread: 0 },
    ])
    jest
      .spyOn(messagesApi, 'thread')
      .mockResolvedValue([{ ...serverMsg(777, 'hallo'), createdAt: '2026-09-02T10:00:05.000Z' }])
    const sendSpy = jest.spyOn(messagesApi, 'send').mockResolvedValue(serverMsg(999, 'hallo'))

    useChatOutboxStore.getState().flush()
    await settle()

    expect(sendSpy).not.toHaveBeenCalled() // resend mù = người nhận thấy tin đôi
    expect(useChatOutboxStore.getState().items[0]).toMatchObject({ status: 'confirmed', serverId: 777 })
  })

  it('F-13 class: retry khớp echo trong channel (GET không side-effect) → confirm, không post lại', async () => {
    const sentAt = '2026-09-02T10:00:00.000Z'
    useChatOutboxStore.setState({
      items: [
        { tempId: 't-c', kind: 'class', targetId: 42, body: 'cả lớp ơi', createdAt: sentAt, status: 'failed', retryable: true },
      ],
    })
    jest
      .spyOn(classChannelApi, 'list')
      .mockResolvedValue([{ ...serverClassMsg(555, 'cả lớp ơi'), createdAt: '2026-09-02T10:00:03.000Z' }])
    const postSpy = jest.spyOn(classChannelApi, 'post').mockResolvedValue(serverClassMsg(556, 'cả lớp ơi'))

    useChatOutboxStore.getState().flush()
    await settle()

    expect(postSpy).not.toHaveBeenCalled()
    expect(useChatOutboxStore.getState().items[0]).toMatchObject({ status: 'confirmed', serverId: 555 })
  })

  it('reconcile retires only the confirmed shadows a real fetch surfaced', () => {
    useChatOutboxStore.setState({
      items: [
        { tempId: 'a', kind: 'dm', targetId: 5, body: 'x', createdAt: '1', status: 'confirmed', serverId: 100 },
        { tempId: 'b', kind: 'dm', targetId: 5, body: 'y', createdAt: '2', status: 'sending' },
      ],
    })
    useChatOutboxStore.getState().reconcile('dm', 5, [100])
    const items = useChatOutboxStore.getState().items
    expect(items.map((i) => i.tempId)).toEqual(['b']) // shadow gone, sending stays
  })

  it('routes a class send through the class channel api', async () => {
    const post = jest.spyOn(classChannelApi, 'post').mockResolvedValue(serverClassMsg(300, 'cả lớp ơi'))
    useChatOutboxStore.getState().send('class', 42, 'cả lớp ơi')
    await settle()
    expect(post).toHaveBeenCalledWith(42, 'cả lớp ơi', expect.stringMatching(/^tmp-/))
    expect(useChatOutboxStore.getState().items[0]).toMatchObject({ status: 'confirmed', serverId: 300 })
  })
})
