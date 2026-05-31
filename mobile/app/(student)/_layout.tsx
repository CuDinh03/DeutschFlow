import { Tabs } from 'expo-router'
import { View, Platform } from 'react-native'
import { Home, BookOpen, Mic, User } from 'lucide-react-native'
import { Colors } from '@/lib/constants'

function TabIcon({ Icon, focused }: { Icon: typeof Home; focused: boolean }) {
  return (
    <View className={`items-center justify-center w-8 h-8 rounded-xl ${focused ? 'bg-[rgba(245,200,66,0.15)]' : ''}`}>
      <Icon size={22} color={focused ? Colors.yellow : Colors.muted} strokeWidth={focused ? 2.5 : 1.8} />
    </View>
  )
}

export default function StudentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#1E1E1E',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.yellow,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Học',
          tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="speaking"
        options={{
          title: 'Speaking',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Mic} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
        }}
      />
    </Tabs>
  )
}
