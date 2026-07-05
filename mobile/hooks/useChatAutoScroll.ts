import { useCallback, useEffect, useRef } from 'react'
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { ChatBubbleVM } from '@/lib/chatBubbles'

// Within this many px of the newest message (offset 0 on an inverted list) counts as "at the bottom".
const NEAR_BOTTOM_PX = 120

/**
 * Keeps an INVERTED chat FlatList pinned to the newest message.
 *
 * The thread renders newest-first (index 0 = newest = visual bottom). When a new bubble arrives —
 * an incoming reply or the user's own optimistic send — the list should scroll to reveal it, BUT
 * only when the user is already at the bottom (or it's their own message). A user scrolled up
 * reading history must never be yanked down. Spread the returned `listRef` + `onScroll` onto the
 * FlatList (with `scrollEventThrottle`).
 */
export function useChatAutoScroll(newest: ChatBubbleVM | undefined): {
  listRef: React.RefObject<FlatList<ChatBubbleVM> | null>
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
} {
  const listRef = useRef<FlatList<ChatBubbleVM>>(null)
  const nearBottomRef = useRef(true)
  const prevKeyRef = useRef<string | undefined>(undefined)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted list: contentOffset.y ~= 0 means pinned to the newest message (the visual bottom).
    nearBottomRef.current = e.nativeEvent.contentOffset.y <= NEAR_BOTTOM_PX
  }, [])

  const newestKey = newest?.key
  const newestMine = newest?.mine === true
  useEffect(() => {
    if (!newestKey || newestKey === prevKeyRef.current) return
    const isFirstFill = prevKeyRef.current === undefined
    const follow = nearBottomRef.current || newestMine
    prevKeyRef.current = newestKey
    // First fill: an inverted list already opens pinned to the newest, so no scroll needed.
    if (!isFirstFill && follow) {
      // rAF lets the new row lay out before we scroll, so the animation lands on it.
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }))
    }
  }, [newestKey, newestMine])

  return { listRef, onScroll }
}
