import api from '@/lib/api'

/**
 * Co-branded certificate API client (D5 cert-lite).
 *
 * Teacher endpoints are authenticated and live under `/v2/teacher/certificates`; the verify
 * endpoint is public under `/public/certificate/{token}`. Paths are relative to the axios
 * `baseURL` (`<origin>/api`), so the `/api` prefix is omitted.
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Full certificate, as rendered / publicly verified. */
export interface Certificate {
  certificateCode: string
  verifyToken: string
  studentName: string
  cefrLevel: string
  score: number | null
  note: string | null
  /** Center co-brand; null when the issuer has no org (default DeutschFlow branding). */
  orgName: string | null
  orgLogoUrl: string | null
  issuedByName: string | null
  issuedAt: string
  active: boolean
}

/** Compact row for the teacher's per-class list. */
export interface CertificateSummary {
  id: number
  certificateCode: string
  verifyToken: string
  studentName: string
  cefrLevel: string
  score: number | null
  issuedAt: string
  active: boolean
}

/** POST /v2/teacher/certificates — request body. */
export interface IssueCertificateInput {
  classId: number
  studentId: number
  cefrLevel: CefrLevel
  score?: number | null
  note?: string | null
}

/** Issue a co-branded certificate to a student in one of the teacher's classes. */
export async function issueCertificate(input: IssueCertificateInput): Promise<Certificate> {
  const res = await api.post<Certificate>('/v2/teacher/certificates', input)
  return res.data
}

/** List certificates issued from a class (teacher must own it). */
export async function listClassCertificates(classId: number | string): Promise<CertificateSummary[]> {
  const res = await api.get<CertificateSummary[]>(`/v2/teacher/certificates/class/${classId}`)
  return res.data
}

/** Revoke (soft-delete) a certificate. */
export async function revokeCertificate(certificateId: number): Promise<void> {
  await api.post(`/v2/teacher/certificates/${certificateId}/revoke`)
}

/** Public verification — fetch an active certificate by its verify token. */
export async function getCertificate(token: string): Promise<Certificate> {
  const res = await api.get<Certificate>(`/public/certificate/${encodeURIComponent(token)}`)
  return res.data
}
