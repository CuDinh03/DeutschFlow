import { describe, expect, it } from 'vitest'
import { isTokenPagePath, scrubUrl, scrubUrlsInText } from './scrubUrl'

/** QLT-20: token/mã một lần không được nằm trong URL gửi analytics. */
describe('scrubUrl', () => {
  it('bỏ token kích hoạt và token lời mời trong query', () => {
    expect(scrubUrl('https://mydeutschflow.com/v2/activate?token=abc123')).toBe('https://mydeutschflow.com/v2/activate')
    expect(scrubUrl('/v2/org/accept?token=xyz')).toBe('/v2/org/accept')
  })

  it('chỉ giữ query trong danh sách cho phép (utm_*, examId, teil…), giữ nguyên thứ tự', () => {
    expect(
      scrubUrl('https://x.com/v2/exam?utm_source=fb&token=t&examId=42&code=999&teil=2&utm_campaign=thu%20dong'),
    ).toBe('https://x.com/v2/exam?utm_source=fb&examId=42&teil=2&utm_campaign=thu%20dong')
  })

  it('tham số lạ/mới mặc định bị bỏ (danh sách cho phép, không phải chặn)', () => {
    expect(scrubUrl('/v2/login?next=%2Fv2%2Factivate%3Ftoken%3Dabc&otp=1&signature=s&gclid=g')).toBe('/v2/login')
  })

  it('thay token trong path của trang chia sẻ bằng :token', () => {
    expect(scrubUrl('https://x.com/phieu/AbC_123-xyz?lang=en')).toBe('https://x.com/phieu/:token?lang=en')
    expect(scrubUrl('/report/r3p0rt/')).toBe('/report/:token/')
    expect(scrubUrl('/certificate/c3rt')).toBe('/certificate/:token')
  })

  it('che token trong path API công khai (request mạng trong bản ghi phiên)', () => {
    expect(scrubUrl('https://api.x.com/api/public/org-invitations/inv-tok/accept')).toBe(
      'https://api.x.com/api/public/org-invitations/:token/accept',
    )
    expect(scrubUrl('/api/public/report-issues/abc')).toBe('/api/public/report-issues/:token')
    expect(scrubUrl('/api/public/grade-report/abc')).toBe('/api/public/grade-report/:token')
  })

  it('bỏ hẳn fragment (phiên hỗ trợ trao mã qua #code=)', () => {
    expect(scrubUrl('https://x.com/v2/support-session#code=SECRET')).toBe('https://x.com/v2/support-session')
    expect(scrubUrl('/v2/practice?tab=read#section')).toBe('/v2/practice?tab=read')
  })

  it('URL tuyệt đối, //host và path tương đối đều giữ nguyên phần không bí mật', () => {
    expect(scrubUrl('http://localhost:3000/v2/student?level=A2')).toBe('http://localhost:3000/v2/student?level=A2')
    expect(scrubUrl('//cdn.x.com/certificate/abc')).toBe('//cdn.x.com/certificate/:token')
    expect(scrubUrl('certificate/abc')).toBe('certificate/:token')
    expect(scrubUrl('/v2/student')).toBe('/v2/student')
  })

  it('khoá bị mã hoá vẫn được nhận đúng; giá trị mã hoá giữ nguyên', () => {
    expect(scrubUrl('/x?utm%5Fsource=a%2Bb&%74oken=abc')).toBe('/x?utm%5Fsource=a%2Bb')
    expect(scrubUrl('/x?tok%65n=abc')).toBe('/x')
  })

  it('không phải URL (`$direct`, tên miền) thì đi qua không đổi; chạy hai lần không đổi thêm', () => {
    expect(scrubUrl('$direct')).toBe('$direct')
    expect(scrubUrl('mydeutschflow.com')).toBe('mydeutschflow.com')
    const once = scrubUrl('https://x.com/phieu/abc?token=1&utm_medium=m')
    expect(scrubUrl(once)).toBe(once)
  })

  it('không che nhầm route có tên gần giống (certificates, reports)', () => {
    expect(scrubUrl('/v2/student/certificates')).toBe('/v2/student/certificates')
    expect(scrubUrl('/v2/teacher/reports/12')).toBe('/v2/teacher/reports/12')
  })
})

describe('scrubUrlsInText', () => {
  it('che token trong path và giá trị query bí mật nằm giữa văn bản tự do', () => {
    expect(scrubUrlsInText('Xác thực tại https://x.com/certificate/abc123 nhé')).toBe(
      'Xác thực tại https://x.com/certificate/:token nhé',
    )
    expect(scrubUrlsInText('a:href="/v2/activate?token=abc&utm_source=x"')).toBe(
      'a:href="/v2/activate?token=:token&utm_source=x"',
    )
  })
})

describe('isTokenPagePath', () => {
  it('nhận ba trang chia sẻ có token, không nhận trang khác', () => {
    expect(isTokenPagePath('/phieu/abc')).toBe(true)
    expect(isTokenPagePath('/report/abc/')).toBe(true)
    expect(isTokenPagePath('/certificate/abc')).toBe(true)
    expect(isTokenPagePath('/v2/student/certificates')).toBe(false)
    expect(isTokenPagePath('/report')).toBe(false)
    expect(isTokenPagePath(null)).toBe(false)
  })
})
