import { useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { Stack, type ErrorBoundaryProps } from 'expo-router'

import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider, focusManager } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  useFonts as useSerif,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader'
import {
  useFonts as useSans,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { useSrsOfflineStore } from '@/stores/useSrsOfflineStore'
import { useChatOutboxStore } from '@/stores/useChatOutboxStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { queryClient } from '@/lib/queryClient'
import { getAccessToken } from '@/lib/auth'
import { initObservability, wrapWithObservability, reportError } from '@/lib/observability'
import { ThemedText, Button } from '@/components/ui'
import { initCertPinning } from '@/lib/certPinning'
import { initDeviceIntegrity } from '@/lib/deviceIntegrity'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { SplashAnimated } from '@/components/SplashAnimated'
import { AiConsentHost } from '@/components/AiConsentSheet'
import { PostHogProvider } from 'posthog-react-native'
import { posthog, setSubscriptionTier } from '@/lib/analytics'

void SplashScreen.preventAutoHideAsync()

// Crash/error reporting bootstrap — guarded no-op until a Sentry DSN is configured (S14).
initObservability()
// TLS pinning bootstrap — guarded no-op until enabled with verified pins + the lib (S12).
initCertPinning()
// Jailbreak/root tamper check — soft signal, dev-warn only; no-op until jail-monkey installed (S13).
initDeviceIntegrity()

function RootStack() {
  const theme = useTheme()
  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
      </Stack>
    </>
  )
}

// Expo Router root error boundary — catches render errors anywhere in the tree.
// It renders OUTSIDE RootLayout's providers, so it brings its own ThemeProvider +
// SafeAreaProvider, and reports to Sentry (a no-op until a DSN is configured).
function ErrorFallback({ retry }: { retry: () => void }) {
  const theme = useTheme()
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
      }}
    >
      <ThemedText variant="display" align="center">
        Đã có lỗi xảy ra
      </ThemedText>
      <ThemedText variant="body" color="muted" align="center">
        Ứng dụng gặp sự cố ngoài ý muốn. Bạn thử lại nhé — nếu vẫn lỗi, hãy đóng và mở lại ứng dụng.
      </ThemedText>
      <Button label="Thử lại" onPress={retry} />
    </View>
  )
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorFallback retry={retry} />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function RootLayout() {
  // Select individual slices (not the whole store) so this root component only
  // re-renders when these specific values change — avoids re-render churn during
  // the auth bootstrap.
  const isLoading = useAuthStore((s) => s.isLoading)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const fetchPlan = usePlanStore((s) => s.fetchPlan)
  const planTier = usePlanStore((s) => s.plan?.tier)
  const [splashDone, setSplashDone] = useState(false)

  const [serifLoaded] = useSerif({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
  })
  const [sansLoaded] = useSans({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  })
  const fontsReady = serifLoaded && sansLoaded

  // The animated splash holds until the app is genuinely ready: fonts loaded and
  // auth resolved. This masks the cold-launch auth gate (app/index.tsx redirect)
  // so it never flashes on screen.
  const appReady = fontsReady && !isLoading

  usePushNotifications()

  useEffect(() => {
    useSrsOfflineStore.getState().loadCount()
    // Sync any offline reviews queued while the app was offline or backgrounded.
    void useSrsOfflineStore.getState().sync()
    // Flush any chat messages that were queued (or failed to send) before a kill/restart.
    useChatOutboxStore.getState().flush()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // Bridge AppState → react-query: RN has no window-focus event, so without this
      // stale queries (unread count, inbox) never refetch when the app returns to the
      // foreground. setFocused(true) lets refetchOnWindowFocus do its job.
      focusManager.setFocused(state === 'active')
      if (state === 'active') {
        void useSrsOfflineStore.getState().sync()
        // Retry chat sends that were queued or failed while the app was backgrounded/offline.
        useChatOutboxStore.getState().flush()
      }
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    async function bootstrap() {
      const token = await getAccessToken()
      if (token) {
        await fetchMe()
        await fetchPlan()
      } else {
        useAuthStore.setState({ isLoading: false })
      }
    }
    void bootstrap()
  }, [fetchMe, fetchPlan])

  // Keep the subscription tier as a PostHog super-property for plan-based funnels.
  useEffect(() => {
    setSubscriptionTier(planTier)
  }, [planTier])

  // Auth routing lives in app/index.tsx (`/`) as a declarative <Redirect>, NOT as an
  // imperative router.replace() from this root layout. The old effect-driven redirect
  // depended on the root navigation state (useRootNavigationState), so each redirect
  // mutated that state and re-rendered this layout, which re-rendered the navigator,
  // which re-synced its state — an infinite feedback loop. Under React 19 + the New
  // Architecture that tripped @react-navigation/core's useSyncState into "Maximum
  // update depth exceeded" and crashed the app at launch. Keeping the root layout
  // free of navigation-state subscriptions removes the amplifier entirely.

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync()
    }
  }, [fontsReady])

  if (!fontsReady) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }} testID="root-layout">
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            {posthog ? (
              <PostHogProvider
                client={posthog}
                autocapture={{
                  captureScreens: true,
                  captureTouches: false,
                }}
              >
                <RootStack />
              </PostHogProvider>
            ) : (
              <RootStack />
            )}
            {/* AI data-sharing consent sheet (5.1.1(i)) — presented on demand via ensureAiConsent(). */}
            <AiConsentHost />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      {splashDone ? null : <SplashAnimated ready={appReady} onDone={() => setSplashDone(true)} />}
    </GestureHandlerRootView>
  )
}

export default wrapWithObservability(RootLayout)
