'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, ShieldCheck, ShieldOff } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  listStudentConsents,
  listStudentGuardians,
  type OrgStudentConsent,
  type OrgStudentDetail,
  type OrgStudentGuardian,
} from '@/lib/orgApi'
import { GaBtn, GaCap, TkBadge } from '@/components/ui-v2'
import { GuardianModal } from './GuardianModal'
import { ConsentModal } from './ConsentModal'

/**
 * Mục "Người giám hộ & đồng ý" trên trang chi tiết học viên (D1/R11, owner chốt 10/09/2026).
 *
 * Ba khối: (1) trạng thái tuổi + đồng ý ghi âm — đúng thứ `MinorGate` đang đọc để khoá/mở phần nói,
 * KHÔNG hiện ngày sinh; (2) danh sách người giám hộ, thêm/sửa qua `GuardianModal` (không xoá);
 * (3) sổ đồng ý chỉ-ghi-thêm, ghi phiếu giấy / thu hồi qua `ConsentModal` (có `ConfirmDialog`).
 *
 * Chỉ tải hồ sơ khi học viên ĐANG là thành viên: máy chủ trả 404 cho người đã rời (trung tâm không
 * còn là bên có nghĩa vụ), nên với họ mục này chỉ hiện tóm tắt từ DTO chi tiết kèm một câu giải thích.
 */

const fmtDateTime = (iso: string | null) => (iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm') : '—')

type ConsentTone = 'green' | 'red' | 'yellow' | 'neutral'
const CONSENT_TONE: Record<OrgStudentDetail['audioConsentState'], ConsentTone> = {
  GRANTED: 'green',
  REVOKED: 'red',
  NEVER_RECORDED: 'yellow',
}
const STATUS_TONE: Record<OrgStudentDetail['minorStatus'], ConsentTone> = {
  UNKNOWN: 'neutral',
  MINOR_LEGAL: 'red',
  MINOR_CENTER_POLICY: 'yellow',
  ADULT: 'green',
}

/** Câu giải thích cho phần nói — khớp bốn nhánh của `MinorGate.assertAudioAllowed`. */
function audioNoteKey(d: OrgStudentDetail): 'audioAdult' | 'audioUnknown' | 'audioOpen' | 'audioLocked' {
  if (d.minorStatus === 'ADULT') return 'audioAdult'
  if (d.minorStatus === 'UNKNOWN') return 'audioUnknown'
  return d.audioConsentState === 'GRANTED' ? 'audioOpen' : 'audioLocked'
}

export function GuardianConsentSection({ detail, onChanged }: { detail: OrgStudentDetail; onChanged: () => void }) {
  const t = useTranslations('v2.org.studentDetail.minor')
  const active = detail.status === 'ACTIVE'
  const [guardians, setGuardians] = useState<OrgStudentGuardian[]>([])
  const [consents, setConsents] = useState<OrgStudentConsent[]>([])
  const [loading, setLoading] = useState(active)
  const [error, setError] = useState('')
  const [guardianModal, setGuardianModal] = useState<{ open: boolean; existing: OrgStudentGuardian | null }>({ open: false, existing: null })
  const [consentModal, setConsentModal] = useState<'grant' | 'revoke' | null>(null)

  const load = useCallback(async () => {
    if (!active) return
    setLoading(true)
    try {
      const [g, c] = await Promise.all([listStudentGuardians(detail.userId), listStudentConsents(detail.userId)])
      setGuardians(g)
      setConsents(c)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [active, detail.userId])

  useEffect(() => { void load() }, [load])

  // Sau mỗi lần ghi: tải lại mục này VÀ tóm tắt ở trang cha (trạng thái đồng ý/số giám hộ đổi).
  const afterWrite = () => { void load(); onChanged() }

  return (
    <section aria-labelledby="minor-cap" data-testid="guardian-consent-section">
      <div className="mb-3.5 mt-[22px]"><GaCap id="minor-cap">{t('cap')}</GaCap></div>

      {/* Khối 1 — trạng thái. Nhãn nhóm tuổi, không ngày sinh. */}
      <div className="border border-ga-line bg-ga-card px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="ga-ui text-ga-caption text-ga-muted">{t('statusLabel')}</span>
            <TkBadge tone={STATUS_TONE[detail.minorStatus]} data-testid="minor-status">{t(`status.${detail.minorStatus}`)}</TkBadge>
          </div>
          <div className="flex items-center gap-2">
            <span className="ga-ui text-ga-caption text-ga-muted">{t('audioConsentLabel')}</span>
            <TkBadge tone={CONSENT_TONE[detail.audioConsentState]} data-testid="audio-consent-state">{t(`audioConsent.${detail.audioConsentState}`)}</TkBadge>
          </div>
          <span className="ga-ui text-ga-caption text-ga-muted">
            {detail.birthDateRecorded ? t('birthDateRecorded') : t('birthDateMissing')}
          </span>
        </div>
        <p className="ga-ui mt-3 flex items-start gap-2 text-ga-small text-ga-ink" data-testid="audio-note">
          {audioNoteKey(detail) === 'audioLocked'
            ? <ShieldOff size={16} className="mt-0.5 shrink-0 text-ga-red" aria-hidden />
            : <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ga-green" aria-hidden />}
          <span>{t(audioNoteKey(detail))}</span>
        </p>
        {!active && (
          <p className="ga-ui mt-3 text-ga-caption text-ga-muted" data-testid="minor-inactive-note">{t('inactiveNote')}</p>
        )}
      </div>

      {active && (
        <>
          {/* Khối 2 — người giám hộ */}
          <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
            <GaCap>{t('guardiansCap')}</GaCap>
            <GaBtn variant="ghost" size="sm" onClick={() => setGuardianModal({ open: true, existing: null })} data-testid="guardian-add">
              <Plus size={14} /> {t('addGuardian')}
            </GaBtn>
          </div>
          {error && <p className="ga-ui mb-2 text-ga-caption text-ga-red">{t('loadError')}: {error}</p>}
          {loading ? (
            <div className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />
          ) : guardians.length === 0 ? (
            <div className="border border-dashed border-ga-line px-4 py-6 text-center text-ga-small text-ga-muted">{t('noGuardians')}</div>
          ) : (
            <ul className="border border-ga-line bg-ga-card" data-testid="guardian-list">
              {guardians.map((g, i) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 lg:px-5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-ga-body font-semibold text-ga-ink">{g.fullName}</span>
                      <span className="ga-ui text-ga-caption text-ga-muted">{t(`relationship.${g.relationship}`)}</span>
                      {g.primary && <TkBadge tone="teal">{t('primaryBadge')}</TkBadge>}
                    </div>
                    <div className="ga-ui mt-0.5 flex flex-wrap gap-x-3 text-ga-caption text-ga-muted">
                      {g.phone && <span className="font-mono">{g.phone}</span>}
                      {g.email && <span>{g.email}</span>}
                    </div>
                  </div>
                  <GaBtn variant="ghost" size="sm" onClick={() => setGuardianModal({ open: true, existing: g })} aria-label={`${t('editGuardian')} ${g.fullName}`}>
                    <Pencil size={13} /> {t('editGuardian')}
                  </GaBtn>
                </li>
              ))}
            </ul>
          )}

          {/* Khối 3 — sổ đồng ý */}
          <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
            <GaCap>{t('consentsCap')}</GaCap>
            <div className="flex flex-wrap gap-2">
              <GaBtn variant="ghost" size="sm" onClick={() => setConsentModal('revoke')} data-testid="consent-revoke">
                <ShieldOff size={14} /> {t('revokeConsent')}
              </GaBtn>
              <GaBtn variant="primary" size="sm" onClick={() => setConsentModal('grant')} data-testid="consent-grant">
                <ShieldCheck size={14} /> {t('recordConsent')}
              </GaBtn>
            </div>
          </div>
          {loading ? (
            <div className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />
          ) : consents.length === 0 ? (
            <div className="border border-dashed border-ga-line px-4 py-6 text-center text-ga-small text-ga-muted">{t('noConsents')}</div>
          ) : (
            <div className="overflow-x-auto border border-ga-line bg-ga-card">
              <table className="w-full text-ga-small" data-testid="consent-ledger">
                <thead>
                  <tr className="text-left text-ga-muted">
                    <th className="px-3 py-2 font-semibold">{t('colScope')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colAction')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colMethod')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colEffectiveAt')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colGuardian')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colRecordedBy')}</th>
                    <th className="px-3 py-2 font-semibold">{t('colTerms')}</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c) => (
                    <tr key={c.id} className="border-t border-ga-line">
                      <td className="px-3 py-2 text-ga-ink">{t(`scope.${c.scope}`)}</td>
                      <td className="px-3 py-2">
                        <TkBadge tone={c.action === 'GRANTED' ? 'green' : 'red'}>{t(`action.${c.action}`)}</TkBadge>
                      </td>
                      <td className="px-3 py-2 text-ga-muted">{t(`method.${c.method}`)}</td>
                      <td className="px-3 py-2 font-mono text-ga-muted tabular-nums">{fmtDateTime(c.effectiveAt)}</td>
                      <td className="px-3 py-2 text-ga-muted">{c.guardianName ?? '—'}</td>
                      <td className="px-3 py-2 text-ga-muted">
                        {c.recordedByName ?? '—'}
                        {c.note && <span className="ga-ui block text-ga-caption text-ga-subtle">{c.note}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-ga-muted">{c.termsVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="ga-ui mt-2 text-ga-caption text-ga-subtle">{t('ledgerNote')}</p>
        </>
      )}

      {guardianModal.open && (
        <GuardianModal
          studentId={detail.userId}
          existing={guardianModal.existing}
          hasGuardians={guardians.length > 0}
          onClose={() => setGuardianModal({ open: false, existing: null })}
          onSaved={afterWrite}
        />
      )}
      {consentModal && (
        <ConsentModal
          studentId={detail.userId}
          mode={consentModal}
          guardians={guardians}
          onClose={() => setConsentModal(null)}
          onSaved={afterWrite}
        />
      )}
    </section>
  )
}
