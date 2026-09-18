import { View } from 'react-native'
import { ThemedText, Caption } from '@/components/ui'
import { radius, space, useTheme } from '@/lib/theme'

export const LINE_NUMBER_EVERY = 5

/** Dòng của thân bài theo đúng cách tác giả ngắt; dòng trống là khoảng cách giữa hai đoạn. */
export function passageLines(body: string): string[] {
  return body.replace(/\r\n/g, '\n').split('\n')
}

/**
 * Bài đọc dài của Leseverstehen Teil 2 (telc) như trang đề thật: tiêu đề, Vorspann in đậm, thân
 * bài có số dòng mỗi 5 dòng ở lề trái, chú thích từ khó (*) dưới bài. Bản sinh đôi của
 * `frontend/src/components/exam/telc/ReadingPassage.tsx` — số dòng đếm theo dòng TÁC GIẢ ngắt
 * (không đếm dòng trống), để cùng một số dòng trỏ cùng một chỗ trên điện thoại lẫn web.
 */
export function ReadingPassage({
  title,
  vorspann,
  body,
  numbered,
  glossary,
}: {
  title?: string
  vorspann?: string
  body: string
  numbered: boolean
  glossary?: { term: string; explanation: string }[]
}) {
  const { colors: c } = useTheme()
  let counted = 0
  return (
    <View style={{ gap: space[2], backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3] }}>
      {title ? <ThemedText variant="title">{title}</ThemedText> : null}
      {vorspann ? <ThemedText variant="bodyStrong">{vorspann}</ThemedText> : null}
      <View>
        {passageLines(body).map((line, idx) => {
          if (line.trim() === '') return <View key={idx} style={{ height: space[2] }} />
          counted += 1
          const show = numbered && counted % LINE_NUMBER_EVERY === 0
          return (
            <View key={idx} style={{ flexDirection: 'row', gap: space[2] }}>
              <ThemedText variant="caption" color="faint" style={{ width: 22, textAlign: 'right' }}>
                {show ? String(counted) : ''}
              </ThemedText>
              <ThemedText variant="body" color="secondary" style={{ flex: 1 }}>{line}</ThemedText>
            </View>
          )
        })}
      </View>
      {glossary && glossary.length > 0 ? (
        <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.border, paddingTop: space[2] }}>
          <Caption>Chú thích từ khó</Caption>
          {glossary.map((g) => (
            <ThemedText key={g.term} variant="caption" color="secondary">{`*${g.term}: ${g.explanation}`}</ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  )
}
