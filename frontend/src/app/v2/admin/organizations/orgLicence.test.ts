import { describe, it, expect } from 'vitest'
import type { AdminOrgDetail } from '@/lib/adminOrgApi'
import {
  buildLicenceUpdate,
  clampInt,
  dateInputToInstant,
  formFromOrg,
  instantToDateInput,
  isSeatDrop,
  poolSummary,
} from './orgLicence'

/**
 * T-03 — logic thuần của form "Sửa gói & giấy phép": body PATCH chỉ mang trường THẬT SỰ đổi (backend
 * ghi vết từng trường kèm cũ/mới), clamp cùng luật với backend, hạ ghế dưới sĩ số phải nhận ra được.
 */
const org = (over: Partial<AdminOrgDetail> = {}): AdminOrgDetail => ({
  id: 9,
  name: 'TT Alpha',
  slug: 'alpha',
  planCode: 'PRO',
  seatLimit: 50,
  status: 'ACTIVE',
  monthlyTokenPool: 200000,
  poolUnlimited: false,
  validUntil: null,
  suspendedAt: null,
  teacherCount: 3,
  studentCount: 40,
  pendingInvites: 0,
  ...over,
})

describe('clampInt — cùng luật clamp với backend', () => {
  it('âm → 0, rác → fallback, thập phân → làm tròn xuống', () => {
    expect(clampInt('-7')).toBe(0)
    expect(clampInt('abc')).toBe(0)
    expect(clampInt('abc', 5)).toBe(5)
    expect(clampInt('')).toBe(0)
    expect(clampInt('12.9')).toBe(12)
    expect(clampInt(30)).toBe(30)
    expect(clampInt(null)).toBe(0)
  })
})

describe('ngày ↔ instant', () => {
  it('instantToDateInput → yyyy-mm-dd theo ngày địa phương; dateInputToInstant → cuối ngày địa phương', () => {
    const iso = dateInputToInstant('2026-12-31')
    expect(iso).not.toBeNull()
    const d = new Date(iso as string)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 31])
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59])
    expect(instantToDateInput(iso)).toBe('2026-12-31')
  })

  it('chuỗi không hợp lệ / ngày không tồn tại → null; rỗng → ""', () => {
    expect(dateInputToInstant('')).toBeNull()
    expect(dateInputToInstant('31/12/2026')).toBeNull()
    expect(dateInputToInstant('2026-02-30')).toBeNull()
    expect(instantToDateInput(null)).toBe('')
    expect(instantToDateInput('not-a-date')).toBe('')
  })
})

describe('buildLicenceUpdate — chỉ gửi trường đổi', () => {
  it('form khớp trung tâm → null (nút Lưu khoá)', () => {
    const o = org()
    expect(buildLicenceUpdate(o, formFromOrg(o))).toBeNull()
  })

  it('đổi mỗi ghế → body chỉ có seatLimit; ghế âm gửi 0 (không giới hạn)', () => {
    const o = org()
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), seatLimit: '30' })).toEqual({ seatLimit: 30 })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), seatLimit: '-3' })).toEqual({ seatLimit: 0 })
  })

  it('gói so sau khi viết hoa; chuỗi rỗng = bỏ gói', () => {
    const o = org()
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), planCode: 'pro' })).toBeNull()
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), planCode: 'ultra' })).toEqual({ planCode: 'ULTRA' })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), planCode: '' })).toEqual({ planCode: '' })
  })

  it('bật không-giới-hạn → chỉ poolUnlimited:true, KHÔNG gửi pool (backend giữ số cũ)', () => {
    const o = org()
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), poolMode: 'unlimited', monthlyTokenPool: '999' })).toEqual({
      poolUnlimited: true,
    })
  })

  it('từ không-giới-hạn về hạn mức → poolUnlimited:false + pool nếu số khác; pool âm clamp 0', () => {
    const o = org({ poolUnlimited: true, monthlyTokenPool: 200000 })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), poolMode: 'metered' })).toEqual({ poolUnlimited: false })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), poolMode: 'metered', monthlyTokenPool: '500000' })).toEqual({
      poolUnlimited: false,
      monthlyTokenPool: 500000,
    })
    expect(buildLicenceUpdate(org(), { ...formFromOrg(org()), monthlyTokenPool: '-1' })).toEqual({
      monthlyTokenPool: 0,
    })
  })

  it('hạn: xoá → clearValidUntil; đặt ngày mới → validUntil cuối ngày; cùng ngày → không đổi', () => {
    const current = dateInputToInstant('2026-10-31') as string
    const o = org({ validUntil: current })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), validUntil: '' })).toEqual({ clearValidUntil: true })
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), validUntil: '2026-10-31' })).toBeNull()
    const body = buildLicenceUpdate(o, { ...formFromOrg(o), validUntil: '2026-12-31' })
    expect(body?.clearValidUntil).toBeUndefined()
    expect(instantToDateInput(body?.validUntil)).toBe('2026-12-31')
    // Trung tâm vô thời hạn, form để trống → không có gì để xoá.
    expect(buildLicenceUpdate(org(), { ...formFromOrg(org()), validUntil: '' })).toBeNull()
  })

  it('đổi nhiều trường → body gồm đúng các trường đó', () => {
    const o = org()
    expect(buildLicenceUpdate(o, { ...formFromOrg(o), planCode: 'ULTRA', seatLimit: '80', poolMode: 'unlimited' })).toEqual({
      planCode: 'ULTRA',
      seatLimit: 80,
      poolUnlimited: true,
    })
  })
})

describe('isSeatDrop — DEC-16', () => {
  it('hạ dưới sĩ số → true; bằng/trên sĩ số, 0 (không giới hạn) hoặc không đổi ghế → false', () => {
    const o = org({ studentCount: 40 })
    expect(isSeatDrop(o, { seatLimit: 30 })).toBe(true)
    expect(isSeatDrop(o, { seatLimit: 40 })).toBe(false)
    expect(isSeatDrop(o, { seatLimit: 60 })).toBe(false)
    expect(isSeatDrop(o, { seatLimit: 0 })).toBe(false)
    expect(isSeatDrop(o, { planCode: 'ULTRA' })).toBe(false)
  })
})

describe('poolSummary', () => {
  it('unlimited thắng; pool > 0 = metered; pool 0 & không unlimited = unset (429)', () => {
    expect(poolSummary({ monthlyTokenPool: 0, poolUnlimited: true })).toBe('unlimited')
    expect(poolSummary({ monthlyTokenPool: 1000, poolUnlimited: false })).toBe('metered')
    expect(poolSummary({ monthlyTokenPool: 0, poolUnlimited: false })).toBe('unset')
    expect(poolSummary({ monthlyTokenPool: null, poolUnlimited: undefined })).toBe('unset')
  })
})
