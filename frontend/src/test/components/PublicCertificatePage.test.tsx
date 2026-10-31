/**
 * Trang xác thực công khai `/certificate/[token]` — đợt 4A A+B+E.
 *
 * Canh giữ ba điều dễ hỏng âm thầm: đủ ba thứ tiếng theo `?lang`; lời trên giấy không hứa trình độ và
 * không nhắc kỳ thi thật (sổ lời hứa); giấy của người đã xoá tài khoản không còn tên, không còn mã QR.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import certificateDe from '../../../messages/v2/certificate.de.json'
import certificateEn from '../../../messages/v2/certificate.en.json'
import certificateVi from '../../../messages/v2/certificate.vi.json'

const notFoundError = new Error('NEXT_NOT_FOUND')
vi.mock('next/navigation', () => ({
  notFound: () => { throw notFoundError },
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

import CertificatePage, { generateMetadata } from '@/app/certificate/[token]/page'
import type { Certificate } from '@/lib/certificateApi'

const cert = (over: Partial<Certificate> = {}): Certificate => ({
  certificateCode: 'DF-B1-2026-AB12CD34',
  verifyToken: 'tok123',
  studentName: 'Nguyễn Đức',
  cefrLevel: 'B1',
  score: null,
  note: null,
  orgName: 'Trung tâm ATB',
  orgLogoUrl: 'https://r2.test/signed-logo',
  issuedByName: 'Cô Lan',
  issuedAt: '2026-10-31T02:00:00Z',
  active: true,
  erased: false,
  ...over,
})

function stubFetch(body: Certificate | null) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: body !== null, json: async () => body })))
}

async function renderPage(lang?: string) {
  const ui = await CertificatePage({ params: { token: 'tok123' }, searchParams: lang ? { lang } : {} })
  return render(ui)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Trang xác thực chứng nhận', () => {
  it.each([
    ['vi', 'Chứng nhận hoàn thành khoá học', 'không phải chứng chỉ ngôn ngữ'],
    ['en', 'Course completion certificate', 'not a language certificate'],
    ['de', 'Teilnahmebescheinigung', 'kein Sprachzertifikat'],
  ])('hiện đúng ngôn ngữ ?lang=%s, có câu "không phải chứng chỉ" và mã QR', async (lang, title, disclaimer) => {
    stubFetch(cert())
    const { container } = await renderPage(lang)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
    expect(container.textContent).toContain(disclaimer)
    expect(container.querySelector('main')?.getAttribute('lang')).toBe(lang)
    expect(container.querySelector('img[src^="data:image/svg+xml"]')).not.toBeNull()
    expect(container.querySelector('img[src="https://r2.test/signed-logo"]')).not.toBeNull()
  })

  it('giá trị ?lang lạ rơi về tiếng Việt', async () => {
    stubFetch(cert())
    await renderPage('fr')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chứng nhận hoàn thành khoá học')
  })

  it('giấy của người đã xoá tài khoản: chỉ báo hết hiệu lực, không có tên, không có QR', async () => {
    stubFetch(cert({ studentName: '', active: false, erased: true }))
    const { container } = await renderPage('de')

    expect(container.textContent).toContain('nicht mehr gültig')
    expect(container.textContent).toContain('DF-B1-2026-AB12CD34')
    expect(container.querySelector('article')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('giấy đã thu hồi vẫn hiện để đối chiếu, kèm dấu thu hồi', async () => {
    stubFetch(cert({ active: false }))
    const { container } = await renderPage('en')

    expect(screen.getByRole('status').textContent).toContain('has been revoked')
    expect(container.textContent).toContain('Nguyễn Đức')
  })

  it('token sai ra 404', async () => {
    stubFetch(null)
    await expect(renderPage()).rejects.toBe(notFoundError)
  })

  it('thẻ chia sẻ không mang tên học viên', async () => {
    stubFetch(cert())
    const meta = await generateMetadata({ params: { token: 'tok123' }, searchParams: {} })

    expect(String(meta.title)).toContain('B1')
    expect(JSON.stringify(meta)).not.toContain('Nguyễn Đức')
    expect(meta.robots).toMatchObject({ index: false })
  })
})

describe('Từ điển chứng nhận', () => {
  const dicts = { vi: certificateVi.certificate, en: certificateEn.certificate, de: certificateDe.certificate }

  it('ba thứ tiếng có cùng bộ khoá', () => {
    const keys = Object.keys(dicts.vi).sort()
    expect(Object.keys(dicts.en).sort()).toEqual(keys)
    expect(Object.keys(dicts.de).sort()).toEqual(keys)
  })

  it('không hứa trình độ, không nhắc kỳ thi thật', () => {
    const text = JSON.stringify(dicts)
    for (const banned of ['đạt trình độ', 'Goethe', 'telc', 'proficiency', 'Certificate of Completion']) {
      expect(text).not.toContain(banned)
    }
  })
})
