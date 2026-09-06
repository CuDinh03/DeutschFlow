#!/usr/bin/env node
// Bảng kiểm bộ biểu tượng Galerie: vẽ mọi glyph trong lib/galerieGlyphs.json ra một file HTML
// (cỡ 96 + 24, nền giấy và nền mực) để soi hình trước khi mở PR.
//   node scripts/glyph-sheet.mjs            → ghi vào thư mục tạm của hệ điều hành
//   node scripts/glyph-sheet.mjs out.html   → ghi vào đường dẫn chỉ định
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const glyphs = JSON.parse(fs.readFileSync(path.join(here, '..', 'lib', 'galerieGlyphs.json'), 'utf8'))
const INK = '#161513', GOLD = '#FFCD00', RED = '#DA291C', PAPER = '#FBFAF7'

const shape = (s) => typeof s === 'string' ? `<path d="${s}"/>`
  : 'r' in s ? `<rect x="${s.r[0]}" y="${s.r[1]}" width="${s.r[2]}" height="${s.r[3]}"/>`
  : `<circle cx="${s.c[0]}" cy="${s.c[1]}" r="${s.c[2]}"/>`
const svg = (g, size, ink = INK) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><g fill="${GOLD}">${g.gold.map(shape).join('')}</g>` +
  `<g fill="${RED}">${(g.red ?? []).map(shape).join('')}</g>` +
  `<g fill="none" stroke="${ink}" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">${g.ink.map(shape).join('')}</g></svg>`

const cells = Object.entries(glyphs).map(([name, g]) =>
  `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:130px;padding:10px;background:#fff;border:1px solid #E7E3DA;border-radius:4px">` +
  `${svg(g, 96)}<div style="display:flex;gap:8px;align-items:center">${svg(g, 24)}<span style="background:${INK};padding:4px;border-radius:3px">${svg(g, 24, PAPER)}</span></div>` +
  `<code style="font-size:12px">${name}</code><span style="font-size:11px;color:#76716A;text-align:center">${g.label}</span></div>`).join('')
const html = `<!doctype html><meta charset="utf-8"><title>Galerie glyph sheet</title><body style="margin:0;padding:24px;background:${PAPER};font-family:system-ui">` +
  `<h1 style="font-weight:500;font-size:20px">Bộ biểu tượng Galerie · ${Object.keys(glyphs).length} glyph</h1>` +
  `<div style="display:flex;flex-wrap:wrap;gap:12px">${cells}</div></body>`
const out = process.argv[2] ?? path.join(os.tmpdir(), 'galerie-glyph-sheet.html')
fs.writeFileSync(out, html)
console.log(`Đã ghi ${Object.keys(glyphs).length} glyph → ${out}`)
