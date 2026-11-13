import { describe, expect, it } from 'vitest'
import { parseSpot, resolveSpot, spotRange } from './passageSpot'

describe('mở lại chỗ đã lưu từ — vị trí', () => {
  it('đọc at; khối có dấu hai chấm', () => {
    expect(parseSpot('ctx:10:21', 'Zeitaufwand')).toEqual({ b: 'ctx', s: 10, e: 21, w: 'Zeitaufwand' })
    expect(parseSpot('h:teil:0:4:9', null)).toEqual({ b: 'h:teil:0', s: 4, e: 9, w: null })
    expect(parseSpot('ctx:9:3', null)).toBeNull()
    expect(parseSpot('ctx:x:3', null)).toBeNull()
    expect(parseSpot(null, null)).toBeNull()
  })

  it('chữ ở vị trí cũ khớp ⇒ giữ; đề đã sửa ⇒ tìm lại chữ; không thấy ⇒ null', () => {
    const text = 'Ein Projekt über drei Monate.'
    expect(resolveSpot({ b: 'ctx', s: 4, e: 11, w: 'Projekt' }, text)).toEqual({ s: 4, e: 11 })
    expect(resolveSpot({ b: 'ctx', s: 0, e: 7, w: 'projekt' }, text)).toEqual({ s: 4, e: 11 })
    expect(resolveSpot({ b: 'ctx', s: 0, e: 7, w: 'Urlaub' }, text)).toBeNull()
    expect(resolveSpot({ b: 'ctx', s: 0, e: 7, w: null }, undefined)).toBeNull()
  })

  it('dựng Range qua nhiều đoạn span của cùng khối', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<span data-seg data-b="ctx" data-s="0">Ein Pro</span><span data-seg data-b="ctx" data-s="7">jekt über</span>' +
      '<span data-seg data-b="q:1" data-s="0">Projekt</span>'
    const hit = spotRange(root, 'ctx', 4, 11)!
    expect(hit.range.toString()).toBe('Projekt')
    expect(hit.segs).toHaveLength(2)
    expect(spotRange(root, 'ctx', 40, 45)).toBeNull()
  })
})
