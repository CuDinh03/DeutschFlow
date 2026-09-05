#!/usr/bin/env node
/**
 * check-i18n-v2.js — parity guard for the /v2 next-intl catalog.
 *
 * For every area file messages/v2/<area>.<locale>.json, asserts vi/en/de have the *same* leaf-key
 * set (vi is the source of truth). A key present in one locale but missing in another is the most
 * common i18n bug — it renders the raw key (or throws) for users of the missing language.
 *
 * 06/09/2026: also covers the legacy base catalog messages/<locale>.json (area label `base`) —
 * the UTF-8/i18n audit found en.json missing `adminNav.refresh`/`adminNav.refreshing` while vi/de
 * had them, and this script never looked outside messages/v2/.
 *
 * Usage: node scripts/check-i18n-v2.js   (exit 0 = ok, 1 = mismatch)
 */
const fs = require('fs')
const path = require('path')

const LOCALES = ['vi', 'en', 'de']
const DIR = path.join(__dirname, '..', 'messages', 'v2')

function leafPaths(obj, pre = '') {
  const out = []
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const p = pre ? `${pre}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p))
    else out.push(p)
  }
  return out
}

const BASE_DIR = path.join(__dirname, '..', 'messages')

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
// `base` = legacy monolithic catalog messages/<locale>.json; every other entry = a /v2 area.
const areas = ['base', ...new Set(files.map((f) => f.replace(/\.(vi|en|de)\.json$/, '')))]
const fileFor = (area, l) => (area === 'base' ? path.join(BASE_DIR, `${l}.json`) : path.join(DIR, `${area}.${l}.json`))

let failed = false
let totalKeys = 0
for (const area of areas) {
  const keysByLocale = {}
  for (const l of LOCALES) {
    const fp = fileFor(area, l)
    if (!fs.existsSync(fp)) {
      console.error(`✗ ${area}: missing locale file ${path.relative(BASE_DIR, fp)}`)
      failed = true
      keysByLocale[l] = new Set()
      continue
    }
    keysByLocale[l] = new Set(leafPaths(JSON.parse(fs.readFileSync(fp, 'utf8'))))
  }
  const base = keysByLocale.vi
  totalKeys += base.size
  for (const l of ['en', 'de']) {
    const missing = [...base].filter((k) => !keysByLocale[l].has(k))
    const extra = [...keysByLocale[l]].filter((k) => !base.has(k))
    if (missing.length || extra.length) {
      failed = true
      console.error(`✗ ${area} [${l}]: ${missing.length} missing, ${extra.length} extra vs vi`)
      if (missing.length) console.error(`    missing: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`)
      if (extra.length) console.error(`    extra:   ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? ' …' : ''}`)
    }
  }
}

if (failed) {
  console.error('\ni18n /v2 parity check FAILED')
  process.exit(1)
}
console.log(`✓ i18n parity OK — base + ${areas.length - 1} /v2 area(s), ${totalKeys} keys × ${LOCALES.length} locales in sync`)
