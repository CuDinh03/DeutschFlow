// Hướng dẫn phòng thi nói (nút "?" của mẫu v3.4, Đợt 5B): tấm dưới, đi lần lượt các bước.

import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { radius, space, useTheme } from '@/lib/theme'
import { Button, ThemedText } from '@/components/ui'
import { ORAL_GUIDE_STEPS } from '@/lib/oralRoomGuide'

export function OralRoomGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useTheme().colors
  const [step, setStep] = useState(0)
  const last = step >= ORAL_GUIDE_STEPS.length - 1
  const cur = ORAL_GUIDE_STEPS[Math.min(step, ORAL_GUIDE_STEPS.length - 1)]

  function close() {
    setStep(0)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng hướng dẫn" onPress={close} style={{ flex: 1, backgroundColor: c.overlay }} />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: c.surface, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
          paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[8], gap: space[3],
        }}
      >
        <ThemedText variant="label" color="muted">{`Hướng dẫn phòng thi · ${step + 1}/${ORAL_GUIDE_STEPS.length}`}</ThemedText>
        <ThemedText variant="title" accessibilityRole="header">{cur.title}</ThemedText>
        <ThemedText variant="body" color="secondary">{cur.body}</ThemedText>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: space[1] }}>
          {ORAL_GUIDE_STEPS.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i <= step ? c.accent : c.surfaceSunken }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[2] }}>
          {!last ? <Button label="Bỏ qua" variant="ghost" onPress={close} /> : null}
          <View style={{ flex: 1 }}>
            <Button label={last ? 'Vào thi' : 'Tiếp'} onPress={() => (last ? close() : setStep((s) => s + 1))} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
