// Spotlight tour host (onboarding v1) — thay tour thẻ bottom-sheet cũ.
//
// Screens register anchor views via <SpotlightTarget id> / useSpotlightTarget;
// the provider dims the app with an ink scrim, cuts a rounded spotlight over the
// current step's anchor and morphs it between steps with a spring. Steps can
// live on different screens (`route`): the host navigates, then waits for the
// target to mount before measuring. The final step can be tap-through — the
// cutout lets the user's tap reach the real UI, ending the tour with a real
// action (finish is detected via the pathname change).
//
// The scrim is four plain panels around the cutout plus four small corner
// patches that round the cutout to match the ring (lib/spotlightScrim), all
// animated with Reanimated transforms. Deliberately NOT an SVG mask: animated
// SVG attribute updates are unreliable on Fabric in this repo (see the
// skill-tree <G> transform gotcha). Not a Modal either — tap-through needs
// touches to reach the app underneath.
//
// Anchors below the fold: a scrolling screen registers its ScrollView through
// SpotlightScrollHostProvider (Screen does this), so the host scrolls the
// anchor into view BEFORE measuring the cutout (lib/spotlightReveal) instead
// of falling back to a centered tooltip nobody can act on.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  AccessibilityInfo,
  Pressable,
  View,
  useWindowDimensions,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Button, useTabBarClearance } from '@/components/ui'
import { captureEvent } from '@/lib/analytics'
import { useTourStore } from '@/stores/useTourStore'
import { useReducedMotion } from '@/lib/useReducedMotion'
import {
  buildTourSteps,
  type SpotlightStep,
  type SpotlightTourId,
  type SpotlightTourParams,
} from './spotlightTours'
import { scrimZones, scrimZoneTransform, scrimCornerOffsets, scrimCornerRingOffset } from '@/lib/spotlightScrim'
import { revealScrollOffset } from '@/lib/spotlightReveal'
import { useSpotlightScrollHost, type SpotlightScrollHostRef } from './spotlightScrollHost'

// Ink #161513 @ 50% — "lớp mờ nhẹ, chỉ sáng vùng đang chỉ" (owner, QA đợt 0
// 05/09). Plan §5.1 từng chọn 68%, nhưng lớp mờ chưa từng hiện trên bản public
// (xem ghi chú ở scrim bên dưới) nên chưa ai nhìn thấy mức đó. Fixed (not
// theme.overlay): the spotlight look is the same in both themes.
const SCRIM = 'rgba(22, 21, 19, 0.5)'
const CUTOUT_PAD = 8
const CUTOUT_RADIUS = radius['2xl']
const RING_WIDTH = 1.5
const CARD_ESTIMATE = 210 // rough tooltip height used to pick above/below placement
const CARET = 12
// Chờ ScrollView cuộn xong rồi mới đo lại neo (iOS animated ≈ 300ms): đo lặp
// tới khi hai lần liên tiếp bằng nhau, trần REVEAL_SETTLE_MS.
const REVEAL_FIRST_POLL_MS = 120
const REVEAL_POLL_MS = 70
const REVEAL_SETTLE_MS = 900

interface TargetRect {
  x: number
  y: number
  width: number
  height: number
}

type TourSource = 'auto' | 'replay'

interface ActiveTour {
  tourId: SpotlightTourId
  steps: SpotlightStep[]
  source: TourSource
}

interface StepDisplay {
  index: number
  /** null → measure failed/offscreen → flat scrim + centered tooltip fallback. */
  rect: TargetRect | null
}

/** Anchor + the ScrollView (if any) that can bring it into view. */
interface TargetEntry {
  ref: RefObject<View | null>
  scroll: SpotlightScrollHostRef | null
}

interface MeasuredTarget {
  rect: TargetRect
  entry: TargetEntry
}

interface SpotlightContextValue {
  registerTarget: (id: string, ref: RefObject<View | null>, scroll: SpotlightScrollHostRef | null) => void
  unregisterTarget: (id: string, ref: RefObject<View | null>) => void
  startTour: (tourId: SpotlightTourId, source: TourSource, params?: SpotlightTourParams) => void
  activeTourId: SpotlightTourId | null
}

const SpotlightCtx = createContext<SpotlightContextValue | null>(null)

/** Register (and keep registered) an anchor for the given target id. */
export function useSpotlightTarget(id?: string): RefObject<View | null> {
  const ctx = useContext(SpotlightCtx)
  // Nearest scrolling ancestor (Screen scroll / SpotlightScrollHostProvider) —
  // lets the host scroll this anchor into view before measuring it.
  const scroll = useSpotlightScrollHost()
  const ref = useRef<View | null>(null)
  useEffect(() => {
    if (!id || !ctx) return
    ctx.registerTarget(id, ref, scroll)
    return () => ctx.unregisterTarget(id, ref)
  }, [ctx, id, scroll])
  return ref
}

/** Wrapper anchor — measures its children for the spotlight cutout. */
export function SpotlightTarget({
  id,
  style,
  children,
}: {
  id: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const ref = useSpotlightTarget(id)
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  )
}

export function useSpotlightTour(): Pick<SpotlightContextValue, 'startTour' | 'activeTourId'> {
  const ctx = useContext(SpotlightCtx)
  return useMemo(
    () => ({
      startTour: ctx?.startTour ?? (() => {}),
      activeTourId: ctx?.activeTourId ?? null,
    }),
    [ctx],
  )
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** ScrollView's content container — its window-y slides with the scroll offset. */
function innerViewOf(host: ScrollView): View | null {
  // Runtime method of RN's ScrollView (Libraries/Components/ScrollView/ScrollView.js)
  // that the bundled .d.ts leaves out — guard instead of trusting the cast.
  const h = host as unknown as { getInnerViewRef?: () => View | null }
  return typeof h.getInnerViewRef === 'function' ? h.getInnerViewRef() : null
}

function cornerTransform(c: { x: number; y: number }) {
  'worklet'
  return { transform: [{ translateX: c.x }, { translateY: c.y }] }
}

function measureView(view: Pick<View, 'measureInWindow'> | null): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null)
    view.measureInWindow((x, y, width, height) => {
      if ([x, y, width, height].some((v) => typeof v !== 'number' || Number.isNaN(v)) || width <= 0 || height <= 0) {
        resolve(null)
      } else {
        resolve({ x, y, width, height })
      }
    })
  })
}

export function SpotlightTourProvider({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Thanh tab kính nổi đè lên nội dung: neo phải được cuộn lên TRÊN nó.
  const tabClearance = useTabBarClearance()
  const pathname = usePathname()
  // Giảm chuyển động: khung khoét sáng nhảy thẳng sang bước kế thay vì bay bằng
  // spring. Tour vẫn dùng được y nguyên, chỉ bỏ phần chuyển động (F-7).
  const reducedMotion = useReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion

  const targetsRef = useRef(new Map<string, TargetEntry[]>())
  const [active, setActive] = useState<ActiveTour | null>(null)
  const [display, setDisplay] = useState<StepDisplay | null>(null)
  const activeRef = useRef<ActiveTour | null>(null)
  const displayRef = useRef<StepDisplay | null>(null)
  const runIdRef = useRef(0)
  const hasRectRef = useRef(false)
  const stepPathRef = useRef(pathname)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Cutout geometry (window coords, pad included) — springs between steps.
  const hx = useSharedValue(0)
  const hy = useSharedValue(0)
  const hw = useSharedValue(0)
  const hh = useSharedValue(0)

  useEffect(() => {
    void useTourStore.getState().hydrate()
  }, [])

  const registerTarget = useCallback(
    (id: string, ref: RefObject<View | null>, scroll: SpotlightScrollHostRef | null) => {
      const list = targetsRef.current.get(id) ?? []
      targetsRef.current.set(id, [...list.filter((e) => e.ref !== ref), { ref, scroll }])
    },
    [],
  )

  const unregisterTarget = useCallback((id: string, ref: RefObject<View | null>) => {
    const list = targetsRef.current.get(id) ?? []
    targetsRef.current.set(
      id,
      list.filter((e) => e.ref !== ref),
    )
  }, [])

  const measureTarget = useCallback(async (id: string): Promise<MeasuredTarget | null> => {
    const entries = targetsRef.current.get(id) ?? []
    // Most recently registered first — remounted screens replace stale anchors.
    for (let i = entries.length - 1; i >= 0; i--) {
      const rect = await measureView(entries[i].ref.current)
      if (rect) return { rect, entry: entries[i] }
    }
    return null
  }, [])

  /** Poll for the target (it may still be mounting after a tab switch). */
  const waitForTarget = useCallback(
    async (id: string, timeoutMs: number): Promise<MeasuredTarget | null> => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const found = await measureTarget(id)
        if (found) return found
        if (Date.now() > deadline) return null
        await sleep(90)
      }
    },
    [measureTarget],
  )

  // Neo nằm ngoài dải nhìn thấy (dưới thanh tab, trên safe-area) mà màn có
  // ScrollView → cuộn để neo về giữa dải rồi đo lại. Trước 05/09 bước như vậy
  // rơi về "màn mờ phẳng + tooltip giữa màn", người dùng không biết bấm đâu.
  // Offset hiện tại suy từ mép ScrollView − mép khung nội dung (lib/spotlightReveal),
  // không cần theo dõi onScroll ở từng màn.
  const revealTarget = useCallback(
    async ({ rect, entry }: MeasuredTarget): Promise<TargetRect> => {
      const host = entry.scroll?.current
      if (!host) return rect
      const viewport = await measureView(host.getNativeScrollRef?.() ?? null)
      const inner = await measureView(innerViewOf(host))
      if (!viewport || !inner) return rect
      const y = revealScrollOffset({
        cutout: { y: rect.y - CUTOUT_PAD, height: rect.height + CUTOUT_PAD * 2 },
        band: {
          top: Math.max(viewport.y, insets.top),
          bottom: Math.min(viewport.y + viewport.height, winH - tabClearance),
        },
        margin: space[3],
        viewportTop: viewport.y,
        innerTop: inner.y,
      })
      if (y === null) return rect
      host.scrollTo({ y, animated: !reducedMotionRef.current })
      // Đo tới khi hai lần liên tiếp trùng nhau (cuộn + layout đã yên); hết
      // trần thì lấy lần đo cuối.
      const deadline = Date.now() + REVEAL_SETTLE_MS
      await sleep(REVEAL_FIRST_POLL_MS)
      let prev = await measureView(entry.ref.current)
      for (;;) {
        await sleep(REVEAL_POLL_MS)
        const cur = await measureView(entry.ref.current)
        if (cur && prev && Math.abs(cur.y - prev.y) < 0.5 && Math.abs(cur.x - prev.x) < 0.5) return cur
        if (Date.now() > deadline) return cur ?? prev ?? rect
        prev = cur
      }
    },
    [insets.top, tabClearance, winH],
  )

  const finish = useCallback((reason: 'completed' | 'skipped') => {
    const tour = activeRef.current
    if (!tour) return
    runIdRef.current++
    captureEvent('guide_tour_finished', {
      tour: tour.tourId,
      reason,
      last_step: displayRef.current?.index ?? 0,
    })
    void useTourStore.getState().markDone(tour.tourId)
    activeRef.current = null
    displayRef.current = null
    hasRectRef.current = false
    setActive(null)
    setDisplay(null)
  }, [])

  const showStep = useCallback(
    async (tour: ActiveTour, index: number) => {
      const runId = ++runIdRef.current
      const step = tour.steps[index]
      if (!step) return
      if (step.route) router.navigate(step.route)
      // Cross-screen targets need mount time; same-screen ones resolve on the first poll.
      const found = await waitForTarget(step.targetId, step.route ? 4000 : 1800)
      if (runId !== runIdRef.current || activeRef.current !== tour) return
      // Anchor below the fold (SRS card on Heute…) → scroll its ScrollView so the
      // anchor sits mid-screen, then measure again. No-op without a scroll host
      // (tab bar) or when it is already in view.
      const raw = found ? await revealTarget(found) : null
      if (runId !== runIdRef.current || activeRef.current !== tour) return
      // Still off-screen (unscrollable / no host) → centered-tooltip fallback.
      const usable =
        raw && raw.y + raw.height > space[10] && raw.y < winH - space[10] && raw.x < winW && raw.x + raw.width > 0
          ? raw
          : null
      const next: StepDisplay = { index, rect: usable }
      displayRef.current = next
      stepPathRef.current = pathnameRef.current
      setDisplay(next)
      if (usable) {
        const to = {
          x: usable.x - CUTOUT_PAD,
          y: usable.y - CUTOUT_PAD,
          w: usable.width + CUTOUT_PAD * 2,
          h: usable.height + CUTOUT_PAD * 2,
        }
        if (hasRectRef.current && !reducedMotionRef.current) {
          hx.value = withSpring(to.x, motion.spring.snappy)
          hy.value = withSpring(to.y, motion.spring.snappy)
          hw.value = withSpring(to.w, motion.spring.snappy)
          hh.value = withSpring(to.h, motion.spring.snappy)
        } else {
          hx.value = to.x
          hy.value = to.y
          hw.value = to.w
          hh.value = to.h
          hasRectRef.current = true
        }
      }
      captureEvent('guide_tour_step_viewed', { tour: tour.tourId, step: step.id, index })
      void Haptics.selectionAsync()
      AccessibilityInfo.announceForAccessibility(
        `Bước ${index + 1} trên ${tour.steps.length}. ${step.title}. ${step.desc}`,
      )
    },
    [waitForTarget, revealTarget, winH, winW, hx, hy, hw, hh],
  )

  const startTour = useCallback(
    (tourId: SpotlightTourId, source: TourSource, params?: SpotlightTourParams) => {
      if (activeRef.current) return
      if (source === 'auto' && useTourStore.getState().done[tourId]) return
      const steps = buildTourSteps(tourId, params)
      if (steps.length === 0) return
      const tour: ActiveTour = { tourId, steps, source }
      activeRef.current = tour
      setActive(tour)
      captureEvent('guide_tour_started', { tour: tourId, trigger: source })
      void showStep(tour, 0)
    },
    [showStep],
  )

  const goNext = useCallback(() => {
    const tour = activeRef.current
    const cur = displayRef.current
    if (!tour || !cur) return
    if (cur.index >= tour.steps.length - 1) {
      finish('completed')
      return
    }
    void showStep(tour, cur.index + 1)
  }, [finish, showStep])

  // Tap-through completion: the user tapped the real UI and navigated away.
  // Only entering a lesson node counts as "completed" — any other navigation
  // (Android back, deep link, auth redirect) is an abandon at the last step,
  // else the §8 tour-completion KPI over-counts.
  useEffect(() => {
    const tour = activeRef.current
    const cur = displayRef.current
    if (!tour || !cur) return
    const step = tour.steps[cur.index]
    if (step?.tapThrough && pathname !== stepPathRef.current) {
      finish(pathname.startsWith('/node') ? 'completed' : 'skipped')
    }
  }, [pathname, finish])

  const ctxValue = useMemo<SpotlightContextValue>(
    () => ({ registerTarget, unregisterTarget, startTour, activeTourId: active?.tourId ?? null }),
    [registerTarget, unregisterTarget, startTour, active],
  )

  // Lớp mờ = BỐN tấm quanh ô khoét (trên · dưới · trái · phải), cùng phép chia
  // màn hình với StepBlockers (lib/spotlightScrim). Trước 05/09 là MỘT view
  // viền khổng lồ (borderWidth 2000) — không hiện trên build New Architecture
  // của bản public 17. Bản #529 đặt 4 tấm bằng left/top/width/height → mỗi frame
  // spring là một lần commit layout cho 4 view, trên máy thật owner thấy tour
  // "giật, không mượt". Nay mỗi tấm cỡ cố định winW×winH và chỉ animate
  // transform (translate + scale) — chạy trên compositor, không đụng layout;
  // vùng tính một lần mỗi frame qua useDerivedValue rồi 4 style đọc chung.
  const zones = useDerivedValue(() =>
    scrimZones({ x: hx.value, y: hy.value, width: hw.value, height: hh.value }, winW, winH),
  )
  const scrimTop = useAnimatedStyle(() => scrimZoneTransform(zones.value[0], winW, winH))
  const scrimBottom = useAnimatedStyle(() => scrimZoneTransform(zones.value[1], winW, winH))
  const scrimLeft = useAnimatedStyle(() => scrimZoneTransform(zones.value[2], winW, winH))
  const scrimRight = useAnimatedStyle(() => scrimZoneTransform(zones.value[3], winW, winH))
  // Bo tròn ô khoét: 4 tấm mờ để lại góc VUÔNG trong khi khung vàng bo góc
  // (owner QA 05/09). Mỗi góc = miếng vá r×r (overflow hidden) chứa vòng khuyên
  // màu mờ, tâm trùng góc trong → phần góc ngoài cung tròn bị phủ mờ, vùng sáng
  // ôm đúng khung. Cũng chỉ animate translate như 4 tấm.
  const corners = useDerivedValue(() =>
    scrimCornerOffsets({ x: hx.value, y: hy.value, width: hw.value, height: hh.value }, CUTOUT_RADIUS),
  )
  const cornerTL = useAnimatedStyle(() => cornerTransform(corners.value[0]))
  const cornerTR = useAnimatedStyle(() => cornerTransform(corners.value[1]))
  const cornerBL = useAnimatedStyle(() => cornerTransform(corners.value[2]))
  const cornerBR = useAnimatedStyle(() => cornerTransform(corners.value[3]))
  const cornerPatch = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: CUTOUT_RADIUS,
    height: CUTOUT_RADIUS,
    overflow: 'hidden' as const,
  }
  const cornerRing = {
    position: 'absolute' as const,
    width: CUTOUT_RADIUS * 4,
    height: CUTOUT_RADIUS * 4,
    borderRadius: CUTOUT_RADIUS * 2,
    borderWidth: CUTOUT_RADIUS,
    borderColor: SCRIM,
  }
  const scrimPanel = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: winW,
    height: winH,
    backgroundColor: SCRIM,
  }

  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
  }))

  const step = active && display ? active.steps[display.index] : null

  // Trong lúc tour chạy, phần app phía dưới lớp mờ phải BIẾN MẤT với screen
  // reader — nếu không, người dùng VoiceOver vẫn vuốt được vào các phần tử đang
  // bị làm mờ và kích hoạt chúng, phá vỡ tính "chỉ một chỗ bấm được" của tour
  // (QA 2026-08-20, F-8). Riêng bước tap-through thì KHÔNG khoá: mục đích của
  // bước đó chính là để người dùng chạm vào element được chiếu sáng.
  const contentHidden = !!(active && display && step && !step.tapThrough)

  return (
    <SpotlightCtx.Provider value={ctxValue}>
      <View style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={contentHidden}
          importantForAccessibility={contentHidden ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {active && display && step ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: motion.duration.normal }}
            pointerEvents="box-none"
            accessibilityViewIsModal={!step.tapThrough}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 30 }}
          >
            {display.rect ? (
              <>
                <Animated.View pointerEvents="none" style={[scrimPanel, scrimTop]} />
                <Animated.View pointerEvents="none" style={[scrimPanel, scrimBottom]} />
                <Animated.View pointerEvents="none" style={[scrimPanel, scrimLeft]} />
                <Animated.View pointerEvents="none" style={[scrimPanel, scrimRight]} />
                {[cornerTL, cornerTR, cornerBL, cornerBR].map((cornerStyle, i) => (
                  <Animated.View key={i} pointerEvents="none" style={[cornerPatch, cornerStyle]}>
                    <View style={[cornerRing, scrimCornerRingOffset(i, CUTOUT_RADIUS)]} />
                  </Animated.View>
                ))}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    ringStyle,
                    {
                      borderRadius: CUTOUT_RADIUS,
                      borderWidth: RING_WIDTH,
                      borderColor: theme.colors.accent,
                      shadowColor: theme.colors.accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.55,
                      shadowRadius: 10,
                    },
                  ]}
                />
              </>
            ) : (
              // Measure failed → flat scrim, centered tooltip, no cutout.
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SCRIM }}
              />
            )}

            <StepBlockers
              rect={step.tapThrough ? display.rect : null}
              winW={winW}
              winH={winH}
            />

            <StepTooltip
              key={display.index}
              step={step}
              index={display.index}
              total={active.steps.length}
              rect={display.rect}
              winW={winW}
              winH={winH}
              onNext={goNext}
              onSkip={() => finish('skipped')}
            />
          </MotiView>
        ) : null}
      </View>
    </SpotlightCtx.Provider>
  )
}

// Touch interception. Default: one full-screen blocker (taps on the dim do
// nothing — plan §5.1). Tap-through step: four blockers AROUND the cutout so
// only the spotlighted element receives the tap.
function StepBlockers({ rect, winW, winH }: { rect: TargetRect | null; winW: number; winH: number }) {
  if (!rect) {
    return <Pressable accessible={false} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
  }
  const zones: ViewStyle[] = scrimZones(
    {
      x: rect.x - CUTOUT_PAD,
      y: rect.y - CUTOUT_PAD,
      width: rect.width + CUTOUT_PAD * 2,
      height: rect.height + CUTOUT_PAD * 2,
    },
    winW,
    winH,
  ).map((z) => ({ position: 'absolute', ...z }))
  return (
    <>
      {zones.map((z, i) => (
        <Pressable key={i} accessible={false} style={z} />
      ))}
    </>
  )
}

function StepTooltip({
  step,
  index,
  total,
  rect,
  winW,
  winH,
  onNext,
  onSkip,
}: {
  step: SpotlightStep
  index: number
  total: number
  rect: TargetRect | null
  winW: number
  winH: number
  onNext: () => void
  onSkip: () => void
}) {
  const theme = useTheme()
  const cardW = Math.min(winW - space[5] * 2, 360)
  const isLast = index === total - 1

  let cardTop: number
  let below = true
  let caretLeft = cardW / 2 - CARET / 2
  let cardLeft = (winW - cardW) / 2
  if (rect) {
    const cy = rect.y - CUTOUT_PAD
    const ch = rect.height + CUTOUT_PAD * 2
    below = cy + ch + CARD_ESTIMATE + space[6] < winH
    cardTop = below ? cy + ch + space[4] : Math.max(space[10], cy - CARD_ESTIMATE - space[4])
    const centerX = rect.x + rect.width / 2
    cardLeft = Math.min(Math.max(space[5], centerX - cardW / 2), winW - space[5] - cardW)
    caretLeft = Math.min(Math.max(space[4], centerX - cardLeft - CARET / 2), cardW - space[4] - CARET)
  } else {
    cardTop = winH / 2 - CARD_ESTIMATE / 2
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: below ? 10 : -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: motion.duration.normal }}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: cardLeft, top: cardTop, width: cardW }}
    >
      {rect ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: caretLeft,
            [below ? 'top' : 'bottom']: -CARET / 2 + 1,
            width: CARET,
            height: CARET,
            backgroundColor: theme.colors.surface,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ) : null}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: radius['3xl'],
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: space[5],
          gap: space[2],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 18,
          elevation: 12,
        }}
      >
        {total > 1 ? (
          <ThemedText variant="label" color="accent">
            {`Bước ${index + 1}/${total}`}
          </ThemedText>
        ) : null}
        <ThemedText variant="title">{step.title}</ThemedText>
        <ThemedText variant="body" color="secondary">
          {step.desc}
        </ThemedText>

        {total > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: i === index ? 20 : 6,
                  borderRadius: radius.full,
                  backgroundColor: i === index ? theme.colors.accent : theme.colors.border,
                }}
              />
            ))}
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: space[2],
            gap: space[3],
          }}
        >
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel="Bỏ qua hướng dẫn">
            <ThemedText variant="bodyStrong" color="faint">
              Bỏ qua
            </ThemedText>
          </Pressable>
          <Button
            label={isLast ? 'Xong' : 'Tiếp'}
            onPress={onNext}
            fullWidth={false}
            style={{ paddingHorizontal: space[6] }}
          />
        </View>
      </View>
    </MotiView>
  )
}
