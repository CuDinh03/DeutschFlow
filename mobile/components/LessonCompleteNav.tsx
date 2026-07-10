import { View } from 'react-native'
import { space } from '@/lib/theme'
import { Button } from '@/components/ui'

interface LessonCompleteNavProps {
  // Undefined = no next node (end of the unlocked path) → hide the primary button.
  onNext?: () => void
  onRoadmap: () => void
}

// Post-completion navigation shared by every lesson runner (node / node-practice /
// skill-practice). Finishing a lesson must never silently dump the learner on Home:
// all lesson screens are hidden tabs, so `router.back()` unwinds to the index tab.
// Instead the learner explicitly chooses "Bài tiếp theo" (next unlocked node) or
// "Về lộ trình" (the skill tree).
export function LessonCompleteNav({ onNext, onRoadmap }: LessonCompleteNavProps) {
  return (
    <View style={{ gap: space[2] }}>
      {onNext ? <Button label="Bài tiếp theo" onPress={onNext} /> : null}
      <Button label="Về lộ trình" variant="secondary" onPress={onRoadmap} />
    </View>
  )
}
