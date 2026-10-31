// Chứng nhận hoàn thành khoá học của CHÍNH học viên (đợt 4A A+B+E).
//
// Nguồn: `GET /api/student/certificates`, gồm cả giấy đã thu hồi để học viên biết link nào không còn
// dùng được. Khác phiếu gia đình, link xác thực ở đây LÀ thứ học viên giữ và tự chia sẻ, nên màn có nút
// mở link. Trang công khai lo đủ ba thứ tiếng, mã QR và bản in; app không dựng lại.
import { Linking } from 'react-native'
import api from '@/lib/api'

export interface StudentCertificate {
  certificateCode: string
  verifyToken: string
  cefrLevel: string
  orgName: string | null
  issuedAt: string
  active: boolean
}

export const CERTIFICATE_SITE_URL = 'https://mydeutschflow.com'

export function fetchMyCertificates(): Promise<StudentCertificate[]> {
  return api.get<StudentCertificate[]>('/student/certificates').then((r) => r.data ?? [])
}

export function certificateUrl(token: string): string {
  return `${CERTIFICATE_SITE_URL}/certificate/${encodeURIComponent(token)}/`
}

/** Mở giấy trong trình duyệt hệ thống. Best-effort — không ném lỗi. */
export function openCertificate(token: string): void {
  Linking.openURL(certificateUrl(token)).catch(() => {})
}
