import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlanStore } from '@/stores/usePlanStore'
import { useSrsOfflineStore } from '@/stores/useSrsOfflineStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { getAccessToken } from '@/lib/auth'
import '../global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function RootLayout() {
  const { isLoggedIn, isLoading, fetchMe } = useAuthStore()
  const { fetchPlan } = usePlanStore()

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
    if (isLoading) return
    if (!isLoggedIn) {
      router.replace('/(auth)/login')
    }
  }, [isLoggedIn, isLoading])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor="#0D0D0D" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(student)" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
