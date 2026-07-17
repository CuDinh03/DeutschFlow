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
// The scrim + cutout are plain Views (oversized-border trick) animated with
// Reanimated. Deliberately NOT an SVG mask: animated SVG attribute updates are
// unreliable on Fabric in this repo (see the skill-tree <G> transform gotcha).
// Not a Modal either — tap-through needs touches to reach the app underneath.

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
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { router, usePathname } from 'expo-router'
import { MotiView } from 'moti'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { motion, radius, space, useTheme } from '@/lib/theme'
import { ThemedText, Button } from '@/components/ui'
import { captureEvent } from '@/lib/analytics'
import { useTourStore } from '@/stores/useTourStore'
import {
  buildTourSteps,
  type SpotlightStep,
  type SpotlightTourId,
  type SpotlightTourParams,
} from './spotlightTours'

// Ink #161513 @ ~68% — plan §5.1. Fixed (not theme.overlay): the spotlight look
// is the same in both themes.
const SCRIM = 'rgba(22, 21, 19, 0.68)'
// Oversized border that paints the scrim around the transparent cutout. Must
// exceed any screen dimension.
const SCRIM_REACH = 2000
const CUTOUT_PAD = 8
const CUTOUT_RADIUS = radius['2xl']
const RING_WIDTH = 1.5
const CARD_ESTIMATE = 210 // rough tooltip height used to pick above/below placement
const CARET = 12

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

interface SpotlightContextValue {
  registerTarget: (id: string, ref: RefObject<View | null>) => void
  unregisterTarget: (id: string, ref: RefObject<View | null>) => void
  startTour: (tourId: SpotlightTourId, source: TourSource, params?: SpotlightTourParams) => void
  activeTourId: SpotlightTourId | null
}

const SpotlightCtx = createContext<SpotlightContextValue | null>(null)

/** Register (and keep registered) an anchor for the given target id. */
export function useSpotlightTarget(id?: string): RefObject<View | null> {
  const ctx = useContext(SpotlightCtx)
  const ref = useRef<View | null>(null)
  useEffect(() => {
    if (!id || !ctx) return
    ctx.registerTarget(id, ref)
    return () => ctx.unregisterTarget(id, ref)
  }, [ctx, id])
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

function measureView(view: View | null): Promise<TargetRect | null> {
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
  const pathname = usePathname()

  const targetsRef = useRef(new Map<string, RefObject<View | null>[]>())
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

  const registerTarget = useCallback((id: string, ref: RefObject<View | null>) => {
    const list = targetsRef.current.get(id) ?? []
    targetsRef.current.set(id, [...list.filter((r) => r !== ref), ref])
  }, [])

  const unregisterTarget = useCallback((id: string, ref: RefObject<View | null>) => {
    const list = targetsRef.current.get(id) ?? []
    targetsRef.current.set(
      id,
      list.filter((r) => r !== ref),
    )
  }, [])

  const measureTarget = useCallback(async (id: string): Promise<TargetRect | null> => {
    const refs = targetsRef.current.get(id) ?? []
    // Most recently registered first — remounted screens replace stale anchors.
    for (let i = refs.length - 1; i >= 0; i--) {
      const rect = await measureView(refs[i].current)
      if (rect) return rect
    }
    return null
  }, [])

  /** Poll for the target (it may still be mounting after a tab switch). */
  const waitForRect = useCallback(
    async (id: string, timeoutMs: number): Promise<TargetRect | null> => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const rect = await measureTarget(id)
        if (rect) return rect
        if (Date.now() > deadline) return null
        await sleep(90)
      }
    },
    [measureTarget],
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
      const raw = await waitForRect(step.targetId, step.route ? 4000 : 1800)
      if (runId !== runIdRef.current || activeRef.current !== tour) return
      // Off-screen (e.g. below the fold in a ScrollView) → centered-tooltip fallback.
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
        if (hasRectRef.current) {
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
    [waitForRect, winH, winW, hx, hy, hw, hh],
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
  useEffect(() => {
    const tour = activeRef.current
    const cur = displayRef.current
    if (!tour || !cur) return
    const step = tour.steps[cur.index]
    if (step?.tapThrough && pathname !== stepPathRef.current) finish('completed')
  }, [pathname, finish])

  const ctxValue = useMemo<SpotlightContextValue>(
    () => ({ registerTarget, unregisterTarget, startTour, activeTourId: active?.tourId ?? null }),
    [registerTarget, unregisterTarget, startTour, active],
  )

  const scrimStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: hx.value - SCRIM_REACH,
    top: hy.value - SCRIM_REACH,
    width: hw.value + SCRIM_REACH * 2,
    height: hh.value + SCRIM_REACH * 2,
    borderWidth: SCRIM_REACH,
    borderRadius: SCRIM_REACH + CUTOUT_RADIUS,
    borderColor: SCRIM,
  }))

  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
  }))

  const step = active && display ? active.steps[display.index] : null

  return (
    <SpotlightCtx.Provider value={ctxValue}>
      <View style={{ flex: 1 }}>
        {children}
        {active && display && step ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: motion.duration.normal }}
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 30 }}
          >
            {display.rect ? (
              <>
                <Animated.View pointerEvents="none" style={scrimStyle} />
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
  const x = rect.x - CUTOUT_PAD
  const y = rect.y - CUTOUT_PAD
  const w = rect.width + CUTOUT_PAD * 2
  const h = rect.height + CUTOUT_PAD * 2
  const zones: ViewStyle[] = [
    { position: 'absolute', left: 0, top: 0, width: winW, height: Math.max(0, y) },
    { position: 'absolute', left: 0, top: y + h, width: winW, height: Math.max(0, winH - y - h) },
    { position: 'absolute', left: 0, top: y, width: Math.max(0, x), height: h },
    { position: 'absolute', left: x + w, top: y, width: Math.max(0, winW - x - w), height: h },
  ]
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
