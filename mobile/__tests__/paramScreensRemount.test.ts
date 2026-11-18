import { readFileSync } from 'fs'
import { join } from 'path'

// Mọi màn học viên sống chung một `Tabs` và không unmount khi đổi tham số route: mở bài/người/lớp
// khác vẫn là bản thể cũ, nên state cục bộ (nháp tin nhắn, câu trả lời, điểm, tệp đính kèm) rò sang
// lần mở sau. Các màn dưới đây giữ dữ liệu theo tham số, nên default export phải remount phần thân
// bằng `key` theo tham số đó. Jest của dự án không render màn, nên test này canh ở mức mã nguồn.
const SCREENS: Array<{ file: string; param: string }> = [
  { file: 'app/(student)/skill-practice.tsx', param: 'nodeId' },
  { file: 'app/(student)/exam-attempt.tsx', param: 'attemptId' },
  { file: 'app/(student)/messages/[userId].tsx', param: 'userId' },
  { file: 'app/(student)/class-chat/[classId].tsx', param: 'classId' },
  { file: 'app/(student)/assignments/[id].tsx', param: 'id' },
]

function defaultExportBody(source: string): string {
  const start = source.indexOf('export default function')
  if (start < 0) throw new Error('không có default export function')
  const end = source.indexOf('\n}\n', start)
  return source.slice(start, end)
}

describe('màn theo tham số remount khi tham số đổi', () => {
  it.each(SCREENS)('$file remount theo $param', ({ file, param }) => {
    const body = defaultExportBody(readFileSync(join(__dirname, '..', file), 'utf8'))
    expect(body).toMatch(new RegExp(`<\\w+Runner key=\\{${param} \\?\\? 'none'\\} />`))
  })
})

// Luyện đề telc (Đợt 4, 19/11/2026): phần thân nhận tham số qua props và được key theo tham số.
const PRACTICE_SCREENS: Array<{ file: string; key: RegExp }> = [
  { file: 'app/(student)/exam-set.tsx', key: /<ExamSet key=\{examId \?\? 'none'\}/ },
  { file: 'app/(student)/exam-full.tsx', key: /<FullIntro key=\{examId \?\? 'none'\}/ },
  { file: 'app/(student)/exam-teil.tsx', key: /<TeilRunner key=\{`\$\{examId\}-\$\{teil\}-\$\{mode \?\? ''\}`\}/ },
]

describe('màn luyện đề remount khi tham số đổi', () => {
  it.each(PRACTICE_SCREENS)('$file remount theo tham số', ({ file, key }) => {
    expect(defaultExportBody(readFileSync(join(__dirname, '..', file), 'utf8'))).toMatch(key)
  })
})
