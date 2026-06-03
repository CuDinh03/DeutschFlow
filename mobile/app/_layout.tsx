import { useEffect, useState } from 'react'
import { Stack, router, useRootNavigationState } from 'expo-router'

import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  useFonts as useSora,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora'
import {
  useFonts as useJakarta,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  useFonts as useMono,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { useSrsOfflineStore } from '@/stores/useSrsOfflineStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { getAccessToken } from '@/lib/auth'
import { initObservability } from '@/lib/observability'
import { initCertPinning } from '@/lib/certPinning'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { SplashAnimated } from '@/components/SplashAnimated'
import '../global.css'

void SplashScreen.preventAutoHideAsync()

// Crash/error reporting bootstrap — guarded no-op until a Sentry DSN is configured (S14).
initObservability()
// TLS pinning bootstrap — guarded no-op until enabled with verified pins + the lib (S12).
initCertPinning()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

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

function RootLayout() {
  const { isLoggedIn, isLoading, fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()
  const rootNavState = useRootNavigationState()
  const [splashDone, setSplashDone] = useState(false)

  const [soraLoaded] = useSora({ Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold })
  const [jakartaLoaded] = useJakarta({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  })
  const [monoLoaded] = useMono({ JetBrainsMono_500Medium, JetBrainsMono_700Bold })
  const fontsReady = soraLoaded && jakartaLoaded && monoLoaded

  usePushNotifications()

  useEffect(() => {
    useSrsOfflineStore.getState().loadCount()
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

  useEffect(() => {
    // Don't navigate until the root navigator has mounted, otherwise expo-router throws
    // "Attempted to navigate before mounting the Root Layout component."
    if (!rootNavState?.key) return
    if (isLoading) return
    if (!isLoggedIn) {
      router.replace('/(auth)/login')
    }
  }, [isLoggedIn, isLoading, rootNavState?.key])

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
            <RootStack />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      {splashDone ? null : <SplashAnimated onDone={() => setSplashDone(true)} />}
    </GestureHandlerRootView>
  )
}

export default RootLayout
