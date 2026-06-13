import { Tabs } from 'expo-router'
import { TabBar } from '@/components/ui/TabBar'
import { TourOverlay } from '@/components/guide/TourOverlay'
import { ScreenTimeTracker } from '@/components/analytics/ScreenTimeTracker'

export default function StudentLayout() {
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
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
      </Tabs>

      {/* One-time new-user tour; auto-shows once, replayable from the guide screen. */}
      <TourOverlay />
      {/* Emits feature_session per screen across the whole student area. */}
      <ScreenTimeTracker />
    </>
  )
}
