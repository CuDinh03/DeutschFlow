#!/usr/bin/env node
/**
 * check-i18n-providers.mjs — provider i18n của mỗi khu phải cấp ĐỦ namespace mà khu đó dùng.
 *
 * `check-i18n-usage.js` hỏi "source xin khoá nào mà catalog không có". Câu hỏi này khác và
 * không phép kiểm nào khác trả lời được: catalog CÓ khoá, nhưng `NextIntlClientProvider` của khu
 * ấy không được cấp nhánh chứa nó — next-intl không ném lỗi, nó in thẳng đường dẫn khoá ra màn
 * hình. Đúng lớp lỗi đã đưa `v2.shell.logout` / `v2.common.start` ra prod khi `pickV2Messages`
 * hard-code sai danh sách lõi.
 *
 * Cách đo: từ mỗi gốc route (`page/layout/template/error/...` trong `src/app`), duyệt cây import
 * nội bộ và gom mọi `useTranslations('X')`. Gán gốc đó cho provider gần nhất đi lên theo thư mục.
 * Yêu cầu: mọi X phải nằm trong phần provider ấy cấp — `v2.<area>` khớp danh sách area (hoặc lõi
 * chrome), namespace gốc khớp khai báo `base:<ns>`.
 *
 * Phần THỪA (provider cấp mà không gốc nào cần) chỉ CẢNH BÁO: phân tích tĩnh không theo được mọi
 * đường (import động dựng chuỗi, component nhận qua props), nên thừa là tín hiệu dọn payload chứ
 * không phải lỗi chặn merge.
 *
 * Usage: node scripts/check-i18n-providers.mjs   (exit 0 = ok, 1 = có khu thiếu namespace)
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const FE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(FE, 'src')

/**
 * Bỏ comment để prose không bị nhặt thành lời gọi — CÙNG THUẬT TOÁN với check-i18n-usage.js, và
 * vì đúng một lý do: bản regex thô `/\/\*[\s\S]*?\*\//` nuốt nhầm khi mã có "/*" bên trong một
 * chuỗi hay một comment dòng. Đã cắn thật ở `(public)/org/accept/client-page.tsx`: dòng 30 nhắc
 * đường dẫn `/v2/` kèm dấu sao trong comment `//`, nên regex coi đó là mở block comment và xoá
 * tiếp 150 dòng tới dấu đóng block ở dòng 186 — nuốt luôn lời gọi `useTranslations` của trang, và
 * phép kiểm im lặng kết luận "không ai cần org.accept". Máy trạng thái theo ký tự phân biệt được ba trạng thái chuỗi /
 * template / comment nên không mắc.
 */
function stripComments(src) {
  const out = Array.from(src)
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') out[i++] = ' '
      continue
    }
    if (c === '/' && next === '*') {
      out[i++] = ' '
      out[i++] = ' '
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i++
      }
      if (i < n) {
        out[i++] = ' '
        out[i++] = ' '
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      i++
      while (i < n) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    i++
  }
  return out.join('')
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(full)
  }
  return acc
}

function resolveImport(fromFile, spec) {
  let p
  if (spec.startsWith('@/')) p = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) p = resolve(dirname(fromFile), spec)
  else return null
  for (const c of [p, `${p}.ts`, `${p}.tsx`, join(p, 'index.ts'), join(p, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

const IMPORT_RE = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g
const NS_RE = /\buseTranslations\(\s*(?:'([^']*)'|"([^"]*)")/g
// `const t = useTranslations('v2')` — cần biết TÊN BIẾN để đọc tiếp các khoá nó gọi.
const BIND_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*(?:'([^']*)'|"([^"]*)")/g
const keyCallRe = (v) => new RegExp(`\\b${v}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`$]*)\\$\\{)`, 'g')
const PROVIDER_RE = /messagesForV2Areas\(([^)]*)\)/
const ROOT_RE = /\/app\/(?:.*\/)?(page|layout|template|error|not-found|loading)\.tsx$/

function scan(files) {
  const imports = new Map()
  const namespaces = new Map()
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'))
    imports.set(
      f,
      [...src.matchAll(IMPORT_RE)].map((m) => resolveImport(f, m[1])).filter(Boolean),
    )
    // Đường dẫn ĐẦY ĐỦ mà tệp này thật sự đọc: 'v2.student.foo', 'speaking.chat.bar'…
    // Một tệp dùng `useTranslations('v2')` rồi gọi `t('shell.logout')` chỉ cần nhánh `v2.shell`,
    // không cần cả cây `v2` — kiểm theo namespace trần sẽ báo sai ở MỌI khu.
    const paths = new Set()
    for (const bind of src.matchAll(BIND_RE)) {
      const [, varName, q1, q2] = bind
      const ns = q1 ?? q2
      if (!ns) continue
      let sawKey = false
      for (const call of src.matchAll(keyCallRe(varName))) {
        const key = call[1] ?? call[2] ?? call[3]
        if (key === undefined || key === '') continue
        // Khoá ghép lúc chạy: chỉ phần TĨNH trước ${ mới kiểm được (như check-i18n-usage.js).
        const isTemplate = call[3] !== undefined
        const head = isTemplate ? key.slice(0, key.lastIndexOf('.')) : key
        if (isTemplate && !head) continue
        paths.add(`${ns}.${head}`)
        sawKey = true
      }
      if (!sawKey) paths.add(ns)
    }
    for (const m of src.matchAll(NS_RE)) {
      const ns = m[1] ?? m[2]
      // Dạng inline `useTranslations('x')(...)`: không có biến để lần khoá, giữ cả namespace.
      if (ns && ![...paths].some((p) => p === ns || p.startsWith(`${ns}.`))) paths.add(ns)
    }
    namespaces.set(f, paths)
  }
  return { imports, namespaces }
}

/** Lõi chrome mọi provider đều mang — đọc từ chính file, cùng nguồn sự thật với pickV2Messages. */
const V2_CORE = Object.keys(JSON.parse(readFileSync(join(FE, 'messages', 'v2', 'chrome.vi.json'), 'utf8')))

/** Một namespace được cấp khi nó, hoặc một tổ tiên của nó, nằm trong danh sách provider. */
function covered(ns, declared) {
  const segs = ns.split('.')
  for (let i = segs.length; i > 0; i -= 1) {
    if (declared.has(segs.slice(0, i).join('.'))) return true
  }
  return false
}

function analyse(files, imports, namespaces) {
  const providers = new Map()
  for (const f of files) {
    if (!f.endsWith('/layout.tsx')) continue
    const m = readFileSync(f, 'utf8').match(PROVIDER_RE)
    if (m) providers.set(dirname(f), [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
  }

  const providerFor = (file) => {
    let d = dirname(file)
    while (d.startsWith(SRC)) {
      if (providers.has(d)) return d
      d = dirname(d)
    }
    return null
  }

  const needed = new Map()
  for (const root of files.filter((f) => ROOT_RE.test(f))) {
    const prov = providerFor(root)
    if (!prov) continue
    const seen = new Set()
    const stack = [root]
    while (stack.length) {
      const cur = stack.pop()
      if (seen.has(cur)) continue
      seen.add(cur)
      if (!needed.has(prov)) needed.set(prov, new Map())
      for (const ns of namespaces.get(cur) ?? []) {
        if (!needed.get(prov).has(ns)) needed.get(prov).set(ns, relative(FE, cur))
      }
      for (const dep of imports.get(cur) ?? []) {
        // Không đi xuyên layout của khu khác: cây đó có provider riêng.
        if (dep.endsWith('/layout.tsx') && providers.has(dirname(dep)) && dirname(dep) !== prov) continue
        stack.push(dep)
      }
    }
  }

  const missing = []
  const unused = []
  for (const [prov, decl] of providers) {
    const declared = new Set([...decl.map((d) => (d.startsWith('base:') ? d.slice(5) : `v2.${d}`)), ...V2_CORE.map((c) => `v2.${c}`)])
    const want = needed.get(prov) ?? new Map()
    for (const [ns, file] of want) {
      if (!covered(ns, declared)) missing.push({ prov: relative(FE, prov), ns, file })
    }
    for (const d of decl) {
      const full = d.startsWith('base:') ? d.slice(5) : `v2.${d}`
      if (![...want.keys()].some((ns) => ns === full || ns.startsWith(`${full}.`))) {
        unused.push({ prov: relative(FE, prov), decl: d })
      }
    }
  }
  return { providers, missing, unused }
}

/**
 * NEGATIVE CONTROL — một phép kiểm không bao giờ đỏ thì không phân biệt được với phép kiểm không
 * chạy. Dựng bộ ba tình huống trong bộ nhớ và bắt buộc bộ dò nhận đúng.
 */
function selfTest() {
  const cases = [
    { name: 'khớp chính xác', ns: 'v2.teacher', declared: ['v2.teacher'], want: true },
    { name: 'tổ tiên phủ con', ns: 'v2.student.micGuide.site', declared: ['v2.student'], want: true },
    { name: 'nhánh con KHÔNG phủ cha', ns: 'v2.student', declared: ['v2.student.micGuide'], want: false },
    { name: 'namespace gốc cần khai base:', ns: 'speaking', declared: ['v2.student'], want: false },
    { name: 'base: khai rồi thì phủ', ns: 'speaking.chat', declared: ['speaking'], want: true },
  ]
  const bad = cases.filter((c) => covered(c.ns, new Set(c.declared)) !== c.want)
  if (bad.length) {
    console.error('✗ check-i18n-providers SELF-TEST FAILED:', bad.map((c) => c.name).join(', '))
    process.exit(1)
  }
  return cases.length
}

const selfTestCases = selfTest()
const files = walk(SRC)
const { imports, namespaces } = scan(files)
const { providers, missing, unused } = analyse(files, imports, namespaces)

for (const m of missing) {
  console.error(`✗ ${m.prov} — provider KHÔNG cấp '${m.ns}' mà ${m.file} dùng`)
}
for (const u of unused) {
  console.warn(`⚠ ${u.prov} — khai '${u.decl}' nhưng không gốc route nào trong khu cần (payload thừa?)`)
}

if (missing.length) {
  console.error(
    `\ni18n provider check FAILED — ${missing.length} namespace thiếu.` +
      `\nnext-intl không ném lỗi: nó in thẳng đường dẫn khoá ra màn hình người dùng.` +
      `\nThêm area (hoặc 'base:<ns>') vào messagesForV2Areas của layout khu tương ứng.`,
  )
  process.exit(1)
}
console.log(
  `✓ i18n provider OK — ${providers.size} provider, ${files.length} tệp nguồn, ${unused.length} khai báo thừa` +
    ` (self-test: ${selfTestCases}/${selfTestCases} ca)`,
)
