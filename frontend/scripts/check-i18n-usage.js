#!/usr/bin/env node
/**
 * check-i18n-usage.js — reverse guard for the next-intl catalog.
 *
 * check-i18n-v2.js proves vi/en/de agree with EACH OTHER. It is structurally blind to a namespace
 * or key missing from ALL THREE: parity stays balanced, the check prints "in sync", and the page
 * still renders the raw key path to users — next-intl returns "v2.student.exercises.title" instead
 * of throwing. That is exactly how `v2.student.exercises` and `v2.student.legoGame` shipped broken
 * and stayed broken through every green CI run.
 *
 * This walks the other direction: every namespace and every literal key the SOURCE asks for must
 * resolve in the vi catalog. vi is the source of truth; check-i18n-v2.js then carries en/de.
 *
 * Usage: node scripts/check-i18n-usage.js   (exit 0 = ok, 1 = unresolved namespace/key)
 */
const fs = require('fs')
const path = require('path')

const FE = path.join(__dirname, '..')
const SRC = path.join(FE, 'src')
const REQUEST_TS = path.join(SRC, 'i18n', 'request.ts')

/**
 * The v2 areas are read back out of request.ts rather than duplicated here. Two reasons: the lists
 * cannot drift apart, and an area file that exists on disk but was never registered in request.ts
 * is genuinely NOT loaded at runtime — mirroring the hardcoded list is what makes this guard agree
 * with what the app actually serves.
 */
function readV2Areas() {
  const src = fs.readFileSync(REQUEST_TS, 'utf8')
  const m = src.match(/const\s+V2_AREAS\s*=\s*\[([^\]]*)\]/)
  if (!m) {
    console.error(`✗ could not find V2_AREAS in ${path.relative(FE, REQUEST_TS)} — update this guard`)
    process.exit(1)
  }
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2])
}

function buildCatalog() {
  const base = JSON.parse(fs.readFileSync(path.join(FE, 'messages', 'vi.json'), 'utf8'))
  const v2 = {}
  for (const area of readV2Areas()) {
    Object.assign(v2, JSON.parse(fs.readFileSync(path.join(FE, 'messages', 'v2', `${area}.vi.json`), 'utf8')))
  }
  return { ...base, v2 }
}

/** Walk a dotted path. Returns the node, or undefined when any segment is missing. */
function resolve(root, dotted) {
  let cur = root
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined
    cur = cur[part]
  }
  return cur
}

/**
 * Blank out comments so prose can't be mistaken for code. Naive regexes get this wrong in both
 * directions: `'https://x'` is not a comment, and `// t('foo')` is not a call. So track string,
 * template and comment state character by character. Replaced with spaces, not deleted, so any
 * offset-based reporting stays truthful.
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
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

const QUOTED = `(?:'([^']*)'|"([^"]*)")`
// `const t = useTranslations('ns')` — binds a variable to a namespace.
const BIND_RE = new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*${QUOTED}`, 'g')
// Any useTranslations('ns'), including forms the binder above misses (inline, reassigned, etc.).
const NS_RE = new RegExp(String.raw`\buseTranslations\(\s*${QUOTED}`, 'g')

/**
 * Accessors that must resolve to a renderable message. `.has` is deliberately absent from the
 * alternation: it is an existence PROBE, called precisely because the key may be missing, so
 * demanding it resolve would invert its meaning — and since `.has` is not listed, `t.has('x')`
 * simply never matches this pattern.
 */
function keyCallRe(varName) {
  return new RegExp(String.raw`\b${varName}(\.rich|\.raw|\.markup)?\(\s*${QUOTED}`, 'g')
}

/**
 * `.raw` is the escape hatch for structured messages — `t.raw('page.faq') as FaqItem[]` pulls an
 * array out on purpose. So `.raw` requires the key to EXIST but may resolve to any type; every
 * other accessor renders text and a group there would surface as "[object Object]".
 */
function mustBeRenderable(accessor) {
  return accessor !== '.raw'
}

/** Scan one source file's text against a catalog. Pure — this is what the self-test exercises. */
function scanSource(rawText, catalog, rel) {
  const badNamespaces = []
  const badKeys = []
  let checkedNamespaces = 0
  let checkedKeys = 0
  const src = stripComments(rawText)

  for (const m of src.matchAll(NS_RE)) {
    const ns = m[1] ?? m[2]
    checkedNamespaces++
    const node = resolve(catalog, ns)
    if (node === undefined) badNamespaces.push({ rel, ns, why: 'not found in the vi catalog' })
    else if (typeof node !== 'object' || node === null)
      badNamespaces.push({ rel, ns, why: 'resolves to a string, not a message group' })
  }

  for (const bind of src.matchAll(BIND_RE)) {
    const varName = bind[1]
    const ns = bind[2] ?? bind[3]
    const nsNode = resolve(catalog, ns)
    if (nsNode === undefined || typeof nsNode !== 'object') continue // already reported above

    for (const call of src.matchAll(keyCallRe(varName))) {
      const key = call[2] ?? call[3]
      if (key === undefined || key === '') continue
      checkedKeys++
      const node = resolve(nsNode, key)
      if (node === undefined) badKeys.push({ rel, ns, key, why: 'missing' })
      else if (mustBeRenderable(call[1]) && typeof node === 'object' && node !== null)
        badKeys.push({ rel, ns, key, why: 'resolves to a group, not a message' })
    }
  }
  return { badNamespaces, badKeys, checkedNamespaces, checkedKeys }
}

/**
 * NEGATIVE CONTROL — runs on every invocation, before the real scan.
 *
 * The guard this one exists to backstop (check-i18n-v2.js) printed a confident green tick for weeks
 * while three namespaces were missing: it was structurally incapable of seeing them. A detector
 * that cannot fail is indistinguishable from one that finds nothing. So plant each failure class in
 * a fixture and require the scanner to catch it — and plant the legitimate shapes too, because a
 * scanner that flags `t.has` or commented-out code gets switched off within a week.
 *
 * If this ever fails, do NOT relax it. It means the scan below is no longer detecting, and every
 * green run since the regression was worthless.
 */
function selfTest() {
  const catalog = { real: { greet: 'xin chào', group: { nested: 'x' } } }
  const cases = [
    { name: 'catches a missing namespace', src: `const t = useTranslations('ghost')`, ns: 1, keys: 0 },
    { name: 'catches a missing key', src: `const t = useTranslations('real')\nt('nope')`, ns: 0, keys: 1 },
    { name: 'catches a key that is a group', src: `const t = useTranslations('real')\nt('group')`, ns: 0, keys: 1 },
    { name: 'catches a namespace that is a leaf', src: `const t = useTranslations('real.greet')`, ns: 1, keys: 0 },
    { name: 'accepts a real key', src: `const t = useTranslations('real')\nt('greet')`, ns: 0, keys: 0 },
    { name: 'accepts a nested key', src: `const t = useTranslations('real')\nt('group.nested')`, ns: 0, keys: 0 },
    { name: 'accepts t.raw on a group', src: `const t = useTranslations('real')\nt.raw('group')`, ns: 0, keys: 0 },
    { name: 'accepts t.has on a missing key', src: `const t = useTranslations('real')\nt.has('nope')`, ns: 0, keys: 0 },
    { name: 'ignores a line comment', src: `const t = useTranslations('real')\n// t('nope')`, ns: 0, keys: 0 },
    { name: 'ignores a block comment', src: `const t = useTranslations('real')\n/* t('nope') */`, ns: 0, keys: 0 },
    { name: 'ignores a URL that looks like a comment', src: `const u = 'https://x/y'\nconst t = useTranslations('real')\nt('greet')`, ns: 0, keys: 0 },
    { name: 'handles double quotes', src: `const t = useTranslations("real")\nt("nope")`, ns: 0, keys: 1 },
    { name: 'tracks a second binding separately', src: `const t = useTranslations('real')\nconst tx = useTranslations('real')\ntx('nope')`, ns: 0, keys: 1 },
  ]

  const failures = []
  for (const c of cases) {
    const r = scanSource(c.src, catalog, '<self-test>')
    if (r.badNamespaces.length !== c.ns || r.badKeys.length !== c.keys) {
      failures.push(
        `    ${c.name}: expected ${c.ns} bad namespace(s) / ${c.keys} bad key(s), ` +
          `got ${r.badNamespaces.length} / ${r.badKeys.length}`,
      )
    }
  }
  if (failures.length) {
    console.error('✗ check-i18n-usage SELF-TEST FAILED — the scanner is not detecting correctly:')
    for (const f of failures) console.error(f)
    console.error('\nEvery green run of this guard since the regression was meaningless. Fix the scanner.')
    process.exit(1)
  }
  return cases.length
}

const selfTestCases = selfTest()

const catalog = buildCatalog()
const files = walk(SRC)

const badNamespaces = []
const badKeys = []
let checkedNamespaces = 0
let checkedKeys = 0

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('useTranslations')) continue
  const r = scanSource(raw, catalog, path.relative(FE, file))
  badNamespaces.push(...r.badNamespaces)
  badKeys.push(...r.badKeys)
  checkedNamespaces += r.checkedNamespaces
  checkedKeys += r.checkedKeys
}

for (const b of badNamespaces) console.error(`✗ ${b.rel}\n    useTranslations('${b.ns}') — ${b.why}`)
for (const b of badKeys) console.error(`✗ ${b.rel}\n    ${b.ns}.${b.key} — ${b.why}`)

if (badNamespaces.length || badKeys.length) {
  console.error(
    `\ni18n usage check FAILED — ${badNamespaces.length} namespace(s), ${badKeys.length} key(s) unresolved.` +
      `\nnext-intl does not throw on these: it renders the raw key path to users.` +
      `\nAdd them to messages/ (vi first, then en/de — check-i18n-v2.js enforces parity).`,
  )
  process.exit(1)
}
console.log(
  `✓ i18n usage OK — ${checkedNamespaces} namespace(s) and ${checkedKeys} literal key(s) across ${files.length} source file(s) all resolve in vi` +
    ` (self-test: ${selfTestCases}/${selfTestCases} detector cases passed)`,
)
