import { Redirect, Tabs } from 'expo-router'
import { TabBar } from '@/components/ui/TabBar'
import { SpotlightTourProvider } from '@/components/guide/SpotlightTour'
import { ScreenTimeTracker } from '@/components/analytics/ScreenTimeTracker'
import { useAuthStore } from '@/stores/useAuthStore'

export default function StudentLayout() {
  // F-28 (soát 02/09): chặn TRƯỚC thay vì phản ứng. Trước đây nhóm (student) chỉ
  // dựa interceptor 401 đá về login — deep link vào thẳng một màn (student)/* khi
  // chưa đăng nhập vẫn mount màn đó một nhịp. Gương đúng logic gate của
  // app/index.tsx (declarative <Redirect>, chờ isLoading kẻo đá nhầm lúc khôi
  // phục phiên khi mở app).
  const isLoading = useAuthStore((s) => s.isLoading)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (isLoading) return null
  if (!isLoggedIn) return <Redirect href="/(auth)/login" />

  return (
    <SpotlightTourProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Heute' }} />
        <Tabs.Screen name="learn" options={{ title: 'Học' }} />
        <Tabs.Screen name="speaking" options={{ title: 'Speaking' }} />
        <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />

        {/* Detail routes: reachable via router.push, not shown as tabs */}
        <Tabs.Screen name="guide" options={{ href: null }} />
        <Tabs.Screen name="exam" options={{ href: null }} />
        <Tabs.Screen name="exam-attempt" options={{ href: null }} />
        <Tabs.Screen name="exam-review" options={{ href: null }} />
        <Tabs.Screen name="node" options={{ href: null }} />
        <Tabs.Screen name="node-practice" options={{ href: null }} />
        <Tabs.Screen name="grammar" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="roadmap" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="srs" options={{ href: null }} />
        <Tabs.Screen name="stats" options={{ href: null }} />
        <Tabs.Screen name="upgrade" options={{ href: null }} />
        <Tabs.Screen name="vocabulary" options={{ href: null }} />
        <Tabs.Screen name="video-lesson" options={{ href: null }} />
        <Tabs.Screen name="weekly-speaking" options={{ href: null }} />
        <Tabs.Screen name="weekly-detail" options={{ href: null }} />
        <Tabs.Screen name="classes" options={{ href: null }} />
        <Tabs.Screen name="assignments" options={{ href: null }} />
        <Tabs.Screen name="speaking-exam" options={{ href: null }} />
        <Tabs.Screen name="speaking-exam-room" options={{ href: null }} />
        <Tabs.Screen name="speaking-exam-result" options={{ href: null }} />
        <Tabs.Screen name="speaking-exam-weakness" options={{ href: null }} />
        <Tabs.Screen name="error-repair" options={{ href: null }} />
        <Tabs.Screen name="lernweg" options={{ href: null }} />
      </Tabs>

      {/* Emits feature_session per screen across the whole student area. */}
      <ScreenTimeTracker />
    </SpotlightTourProvider>
  )
}
