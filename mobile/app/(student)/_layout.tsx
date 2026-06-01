import { Tabs } from 'expo-router'
import { TabBar } from '@/components/ui/TabBar'

export default function StudentLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="learn" options={{ title: 'Học' }} />
      <Tabs.Screen name="speaking" options={{ title: 'Speaking' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />

      {/* Detail routes: reachable via router.push, not shown as tabs */}
      <Tabs.Screen name="exam" options={{ href: null }} />
      <Tabs.Screen name="grammar" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="roadmap" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="srs" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="vocabulary" options={{ href: null }} />
      <Tabs.Screen name="weekly-speaking" options={{ href: null }} />
    </Tabs>
  )
}
