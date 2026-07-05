// Builds the render list for a chat screen by merging server messages with the local outbox.
// Both chat screens use an INVERTED FlatList, so this returns messages NEWEST-FIRST: the freshly
// sent (optimistic) items sit at the top of the array = the visual bottom of the thread, above
// the acknowledged server history. Pure — unit-tested — so the merge/ordering never regresses.
import type { Message } from './messagesApi'
import type { ClassMessage } from './classChannelApi'
import type { OutboxItem } from './chatOutbox'

/** A single rendered bubble. `status` drives the tick/opacity + the failed-retry affordance. */
export interface ChatBubbleVM {
  key: string // FlatList key — `m<id>` for server rows, the tempId for optimistic ones
  body: string
  mine: boolean
  createdAt: string
  status: 'sent' | 'sending' | 'failed'
  realId?: number // numeric server id — present only on acknowledged rows (enables report/delete)
  tempId?: string // present only on optimistic rows — enables tap-to-retry
  senderName?: string // class channel only
  deleted?: boolean // class channel only
  canDelete?: boolean // class channel only
}

const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }): number =>
  b.createdAt.localeCompare(a.createdAt)

/**
 * Outbox → bubbles for one channel, newest-first, always "mine". A 'confirmed' shadow whose real
 * id is already in `serverIds` is dropped (the server row renders it); the rest render — a
 * 'confirmed' shadow the server hasn't surfaced yet shows as a normal 'sent' bubble keyed by its
 * real id, so when the server row finally arrives (same key) the handoff is seamless (no remount).
 */
function outboxBubbles(outbox: readonly OutboxItem[], serverIds: ReadonlySet<number>): ChatBubbleVM[] {
  return [...outbox]
    .filter((i) => !(i.status === 'confirmed' && i.serverId != null && serverIds.has(i.serverId)))
    .sort(byCreatedDesc)
    .map((i) => {
      const confirmed = i.status === 'confirmed' && i.serverId != null
      return {
        key: confirmed ? `m${i.serverId}` : i.tempId,
        tempId: confirmed ? undefined : i.tempId, // retry only applies to a not-yet-sent bubble
        body: i.body,
        mine: true,
        createdAt: i.createdAt,
        status: i.status === 'failed' ? 'failed' : confirmed ? 'sent' : 'sending',
      }
    })
}

/** Merge a DM thread's server messages (any order) with its outbox → newest-first bubbles. */
export function buildDmBubbles(
  server: readonly Message[],
  outbox: readonly OutboxItem[],
): ChatBubbleVM[] {
  const serverBubbles: ChatBubbleVM[] = [...server].sort(byCreatedDesc).map((m) => ({
    key: `m${m.id}`,
    realId: m.id,
    body: m.body,
    mine: m.mine,
    createdAt: m.createdAt,
    status: 'sent',
  }))
  const serverIds = new Set(server.map((m) => m.id))
  return [...outboxBubbles(outbox, serverIds), ...serverBubbles]
}

/** Merge a class channel's server messages with its outbox → newest-first bubbles. */
export function buildClassBubbles(
  server: readonly ClassMessage[],
  outbox: readonly OutboxItem[],
): ChatBubbleVM[] {
  const serverBubbles: ChatBubbleVM[] = [...server].sort(byCreatedDesc).map((m) => ({
    key: `m${m.id}`,
    realId: m.id,
    body: m.body ?? '',
    mine: m.mine,
    createdAt: m.createdAt,
    status: 'sent',
    senderName: m.senderName,
    deleted: m.deleted,
    canDelete: m.canDelete,
  }))
  // An un-sent/optimistic message can't be deleted and shows no sender label (it's mine).
  const serverIds = new Set(server.map((m) => m.id))
  return [...outboxBubbles(outbox, serverIds), ...serverBubbles]
}
