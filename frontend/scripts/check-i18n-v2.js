#!/usr/bin/env node
/**
 * check-i18n-v2.js — parity guard for the /v2 next-intl catalog.
 *
 * For every area file messages/v2/<area>.<locale>.json, asserts vi/en/de have the *same* leaf-key
 * set (vi is the source of truth). A key present in one locale but missing in another is the most
 * common i18n bug — it renders the raw key (or throws) for users of the missing language.
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

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
const areas = [...new Set(files.map((f) => f.replace(/\.(vi|en|de)\.json$/, '')))]

let failed = false
let totalKeys = 0
for (const area of areas) {
  const keysByLocale = {}
  for (const l of LOCALES) {
    const fp = path.join(DIR, `${area}.${l}.json`)
    if (!fs.existsSync(fp)) {
      console.error(`✗ ${area}: missing locale file ${area}.${l}.json`)
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
console.log(`✓ i18n /v2 parity OK — ${areas.length} area(s), ${totalKeys} keys × ${LOCALES.length} locales in sync`)
