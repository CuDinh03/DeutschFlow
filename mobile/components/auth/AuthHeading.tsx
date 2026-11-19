// Tiêu đề lớn của các màn xác thực theo mẫu v3.4 (`h1.lt` + `.mark`): phần đầu chữ thường, phần sau có
// vệt vàng (BrushMark). Gộp làm một tiêu đề cho VoiceOver (`accessibilityRole="header"`).

import { View } from 'react-native'
import { space } from '@/lib/theme'
import { BrushMark, ThemedText } from '@/components/ui'

interface AuthHeadingProps {
  lead: string
  mark: string
  /** Mẫu `login` xuống dòng trước phần có vệt vàng; mẫu `signup` để chung một dòng. */
  stacked?: boolean
}

export function AuthHeading({ lead, mark, stacked = false }: AuthHeadingProps) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${lead} ${mark}`}
      style={
        stacked
          ? { gap: space[1] }
          : { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: space[2], rowGap: space[1] }
      }
    >
      <ThemedText variant="display">{lead}</ThemedText>
      <BrushMark>{mark}</BrushMark>
    </View>
  )
}
