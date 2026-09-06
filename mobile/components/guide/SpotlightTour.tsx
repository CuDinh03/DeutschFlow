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
// The scrim is ONE full-screen SVG path with an even-odd rounded-rect hole
// (lib/spotlightHole); its `d` is driven per frame by Reanimated
// `useAnimatedProps` — the same SVG-prop animation this app already runs on
// Fabric (ProgressRing strokeDashoffset, SplashAnimated). Earlier builds cut
// the hole with four scrim panels + four corner patches (View, overflow
// hidden): the patches rendered on the simulator but NOT on the owner's device
// (06/09/2026), leaving a square lit area under a rounded ring. The only
// animated-SVG prop known to be unreliable here is `<G transform>` (skill-tree
// gotcha) — there is no G in this overlay. As a safety net the settled hole is
// also written from JS as a plain `d` prop after every step (see commitHole).
// Not a Modal either — tap-through needs touches to reach the app underneath.
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
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
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
import { scrimZones, spotlightHolePath } from '@/lib/spotlightHole'
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

const AnimatedPath = Animated.createAnimatedComponent(Path)

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
  // Bản "đã yên" của lỗ khoét, ghi từ JS khi spring kết thúc (hoặc ngay khi
  // nhảy thẳng). Lưới an toàn: nếu animated prop `d` không áp trên một build
  // nào đó, lỗ vẫn về đúng chỗ sau mỗi bước — chỉ mất phần bay.
  const [settledHole, setSettledHole] = useState(() =>
    spotlightHolePath(winW, winH, { x: 0, y: 0, width: 0, height: 0 }, CUTOUT_RADIUS),
  )
  const commitHole = useCallback(
    (to: { x: number; y: number; w: number; h: number }) => {
      setSettledHole(spotlightHolePath(winW, winH, { x: to.x, y: to.y, width: to.w, height: to.h }, CUTOUT_RADIUS))
    },
    [winW, winH],
  )

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
          // Spring cuối xong (không bị bước kế cắt ngang) → ghi bản "đã yên".
          hh.value = withSpring(to.h, motion.spring.snappy, (finished) => {
            if (finished) runOnJS(commitHole)(to)
          })
        } else {
          hx.value = to.x
          hy.value = to.y
          hw.value = to.w
          hh.value = to.h
          hasRectRef.current = true
          commitHole(to)
        }
      }
      captureEvent('guide_tour_step_viewed', { tour: tour.tourId, step: step.id, index })
      void Haptics.selectionAsync()
      AccessibilityInfo.announceForAccessibility(
        `Bước ${index + 1} trên ${tour.steps.length}. ${step.title}. ${step.desc}`,
      )
    },
    [waitForTarget, revealTarget, winH, winW, hx, hy, hw, hh, commitHole],
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

  // Lớp mờ = MỘT path SVG phủ cả màn, khoét lỗ bo tròn bằng luật even-odd
  // (lib/spotlightHole). `d` tính mỗi frame từ hx/hy/hw/hh trong worklet —
  // cùng cơ chế animated-prop SVG mà ProgressRing/SplashAnimated đã chạy trên
  // Fabric. Trước 06/09 là 4 tấm mờ + 4 miếng vá góc (View, overflow hidden):
  // miếng vá hiện trên simulator nhưng KHÔNG hiện trên máy thật của owner →
  // "khung bo góc mà phần sáng vuông". Lỗ dùng CÙNG bán kính với khung vàng nên
  // vùng sáng ôm đúng khung ở mọi bước; StepBlockers vẫn chia vùng bằng
  // scrimZones để bước tap-through chỉ cho chạm vào phần tử được chiếu sáng.
  const holeProps = useAnimatedProps(() => ({
    d: spotlightHolePath(winW, winH, { x: hx.value, y: hy.value, width: hw.value, height: hh.value }, CUTOUT_RADIUS),
  }))

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
                {/* Bọc trong View thường `pointerEvents="none"`: RN bỏ qua cả cây con
                    khi hit-test, còn RNSVG tự hit-test theo hình vẽ và KHÔNG tôn trọng
                    prop này trên Fabric — thiếu lớp bọc thì bước tap-through bị lớp mờ
                    nuốt chạm (bắt được trên simulator 06/09, preview 01a076d2). */}
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, top: 0, width: winW, height: winH }}
                >
                  <Svg pointerEvents="none" width={winW} height={winH}>
                    <AnimatedPath d={settledHole} animatedProps={holeProps} fill={SCRIM} fillRule="evenodd" />
                  </Svg>
                </View>
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
