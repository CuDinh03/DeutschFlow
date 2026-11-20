// Thân một Teil trắc nghiệm KÈM bút đánh dấu (Đợt 4f, 20/11/2026): giữ hook `usePassageMarks` ở đây để
// `ObjGroupView` vẫn là hàm thuần (test dựng cây bằng cách gọi hàm). Dùng ở luyện Teil, bài chẩn đoán
// (lưu theo luyện đề như web), thi thử (lưu theo lượt) và xem lại Teil sau thi thử.
// Teil có bút hay không theo đúng luật web (`lib/marksBlocks.appMarkTexts`); không có thì dựng như cũ.

import { useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import { appMarkInfo } from '@/lib/marksBlocks'
import { usePassageMarks, type MarksSource } from '@/hooks/usePassageMarks'
import { ObjGroupView } from './ExamTeilBody'

type ObjGroupViewProps = Parameters<typeof ObjGroupView>[0]

const NO_TEXTS: Record<string, string> = {}

export function MarkedObjGroup({
  marksSource,
  sectionsJson,
  ...props
}: Omit<ObjGroupViewProps, 'marks'> & {
  /** Nơi lưu đánh dấu; `null` ⇒ không có bút. */
  marksSource: MarksSource | null
  /** Đề thô — lấy chữ từng khối đúng như server băm. */
  sectionsJson: string | null | undefined
}) {
  const teilKey = marksSource?.teilKey ?? ''
  const on = marksSource != null
  // Màn cha dựng `marksSource` mới mỗi lần vẽ — chỉ đọc lại đề khi Teil / đề đổi.
  const info = useMemo(() => (on ? appMarkInfo(sectionsJson, teilKey) : null), [on, sectionsJson, teilKey])
  // Lesen 3: chạm mẩu tin là chọn tình huống (`AdBoard`) ⇒ mở Teil với bút tắt; bật bút mới tô.
  const initialPen = props.group.telcType === 'MATCH_AD_X' ? null : 'y'
  const marks = usePassageMarks({ source: info ? marksSource : null, texts: info?.texts ?? NO_TEXTS, strike: info?.strike, initialPen })
  const flush = marks.flush
  // Rời màn (đổi tab, mở màn khác) ⇒ lưu ngay, không đợi hẹn giờ.
  useFocusEffect(
    useCallback(
      () => () => {
        void flush()
      },
      [flush],
    ),
  )
  return <ObjGroupView {...props} marks={info ? marks : null} />
}
