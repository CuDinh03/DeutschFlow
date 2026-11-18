import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// Screen cuộn tự chừa chỗ cho bàn phím trên iOS (automaticallyAdjustKeyboardInsets). Màn nào đã tự bọc
// KeyboardAvoidingView thì phải tắt bằng keyboardInsets={false}, kẻo nội dung bị đẩy lên hai lần.
const ROOT = join(__dirname, '..')

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : listTsx(p)
    return p.endsWith('.tsx') ? [p] : []
  })
}

/** Thẻ mở `<Screen …>` (có thể nhiều dòng) có prop `scroll`. */
function scrollScreenTags(source: string): string[] {
  return [...source.matchAll(/<Screen\b[^>]*>/gs)].map((m) => m[0]).filter((tag) => /\bscroll\b/.test(tag))
}

describe('Screen cuộn bên trong KeyboardAvoidingView', () => {
  const offenders = [...listTsx(join(ROOT, 'app')), ...listTsx(join(ROOT, 'components'))].flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    if (!source.includes('<KeyboardAvoidingView')) return []
    return scrollScreenTags(source)
      .filter((tag) => !tag.includes('keyboardInsets={false}'))
      .map(() => relative(ROOT, file))
  })

  it('đều tắt keyboardInsets', () => {
    expect(offenders).toEqual([])
  })
})
