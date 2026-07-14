import { describe, expect, test } from 'vitest'
import { homeFor, leadsOrg } from '@/lib/roleRouting'

/**
 * Hồi quy: bản đồ trang-chủ-sau-đăng-nhập của `/login` từng THIẾU nhánh OWNER/MANAGER, nên quản lý
 * trung tâm rơi vào mặc định STUDENT và hạ cánh xuống `/v2/student/dashboard`. Test này chốt cứng
 * mọi vai trò, kể cả cohort token legacy (role=TEACHER + orgRole=MANAGER).
 */
describe('homeFor — trang chủ sau đăng nhập', () => {
  test('quản lý trung tâm (MANAGER) vào console tổ chức, KHÔNG phải dashboard học viên', () => {
    expect(homeFor('MANAGER')).toBe('/v2/org')
  })

  test('chủ trung tâm (OWNER) vào console tổ chức', () => {
    expect(homeFor('OWNER')).toBe('/v2/org')
  })

  test('token legacy role=TEACHER nhưng orgRole điều hành trung tâm → console', () => {
    expect(homeFor('TEACHER', { orgRole: 'MANAGER' })).toBe('/v2/org')
    expect(homeFor('TEACHER', { orgRole: 'OWNER' })).toBe('/v2/org')
    // 'ADMIN' = bí danh org-role của MANAGER trên token trước V225.
    expect(homeFor('TEACHER', { orgRole: 'ADMIN' })).toBe('/v2/org')
  })

  test('giáo viên thường (không điều hành trung tâm) vào khu vực giáo viên', () => {
    expect(homeFor('TEACHER')).toBe('/v2/teacher')
    expect(homeFor('TEACHER', { orgRole: 'TEACHER' })).toBe('/v2/teacher')
    expect(homeFor('TEACHER', { orgRole: null })).toBe('/v2/teacher')
  })

  test('admin nền tảng vào danh sách người dùng (chưa có trang index /v2/admin)', () => {
    expect(homeFor('ADMIN')).toBe('/v2/admin/users')
  })

  test('học viên — và vai trò lạ — vào dashboard học viên', () => {
    expect(homeFor('STUDENT')).toBe('/v2/student/dashboard')
    expect(homeFor('SOMETHING_NEW')).toBe('/v2/student/dashboard')
  })

  test('vỏ native (Expo) dùng route legacy, không vào bề mặt /v2', () => {
    expect(homeFor('MANAGER', { native: true })).toBe('/org')
    expect(homeFor('TEACHER', { native: true })).toBe('/teacher')
    expect(homeFor('STUDENT', { native: true })).toBe('/dashboard')
    expect(homeFor('ADMIN', { native: true })).toBe('/admin')
  })

  test('vai trò không phân biệt hoa thường / khoảng trắng thừa', () => {
    expect(homeFor('manager')).toBe('/v2/org')
    expect(homeFor(' Owner ')).toBe('/v2/org')
    expect(homeFor('TEACHER', { orgRole: ' manager ' })).toBe('/v2/org')
  })
})

describe('leadsOrg', () => {
  test('nhận đúng các org-role điều hành trung tâm', () => {
    expect(leadsOrg('OWNER')).toBe(true)
    expect(leadsOrg('MANAGER')).toBe(true)
    expect(leadsOrg('ADMIN')).toBe(true)
  })

  test('thành viên thường của trung tâm KHÔNG điều hành', () => {
    expect(leadsOrg('TEACHER')).toBe(false)
    expect(leadsOrg('STUDENT')).toBe(false)
    expect(leadsOrg(null)).toBe(false)
    expect(leadsOrg(undefined)).toBe(false)
    expect(leadsOrg('')).toBe(false)
  })
})
