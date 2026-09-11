import * as React from 'react'
import type { ReportPayload, ReportSkillRow } from '@/lib/reportIssueApi'
import { BCP47, fillReport, type ReportLang, type ReportSheetDict } from '@/lib/reportSheetDict'

/**
 * Tờ phiếu đánh giá gửi gia đình — bố cục A4 DỌC theo thiết kế 10/09/2026 §3.3.
 *
 * Không có hook, không `useTranslations`, không gọi mạng: đúng một hàm từ `payload` + `dict` ra JSX.
 * Nhờ vậy DÙNG CHUNG được hai nơi mà hai nơi ấy không giống nhau chút nào — trang công khai
 * `/phieu/[token]` (server component, không phiên đăng nhập) và ô XEM TRƯỚC của giáo viên (client
 * component trong modal). Một tờ phiếu, một đường mã: giáo viên thấy trước đúng thứ phụ huynh sẽ thấy.
 *
 * ⛔ Chỉ đọc những khoá có trong `ReportPayload`. Danh sách cấm (R4) — email, ngày sinh, transcript,
 * audio, `ai_*` — không có trong payload và cũng không được kéo từ nguồn nào khác vào đây.
 *
 * Mọi khối đều ẩn khi dữ liệu vắng (`objectives` null khi lớp chưa gắn giáo trình, `certificate` null
 * ở kỳ giữa khoá): in "0" cho thứ chưa từng được đo là nói sai với gia đình.
 */

export interface ReportSheetHeader {
  orgName: string | null
  orgLogoUrl: string | null
  studentName: string
  issuedByName: string | null
  verificationCode: string | null
  issuedAt: string
  tokenExpiresAt?: string | null
  /** URL trang công khai để in lên phiếu; không có thì khối xác thực chỉ in mã. */
  verifyUrl?: string | null
  revoked?: boolean
}

export interface ReportSheetProps {
  dict: ReportSheetDict
  lang: ReportLang
  payload: ReportPayload
  header: ReportSheetHeader
  /** Bản xem trước của giáo viên: thêm dải nhắc, bỏ khối xác thực và hai ô ký. */
  preview?: boolean
}

const ZONE = 'Asia/Ho_Chi_Minh'

/** Ngày theo múi giờ VN — cùng múi backend dựng payload, nên bản in và bản PDF không lệch một ngày. */
function formatDate(iso: string | null | undefined, lang: ReportLang, fallback: string): string {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fallback
  return new Intl.DateTimeFormat(BCP47[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONE,
  }).format(d)
}

function formatScore(score: number | null | undefined, lang: ReportLang, fallback: string): string {
  if (score == null) return fallback
  return new Intl.NumberFormat(BCP47[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score)
}

function skillLabel(dict: ReportSheetDict, row: ReportSkillRow): string {
  switch (row.code) {
    case 'HOREN':
      return dict.skillHOREN
    case 'LESEN':
      return dict.skillLESEN
    case 'SCHREIBEN':
      return dict.skillSCHREIBEN
    case 'SPRECHEN':
      return dict.skillSPRECHEN
    default:
      return row.code
  }
}

function gradeLabel(dict: ReportSheetDict, grade: string | null): string | null {
  switch (grade) {
    case 'EXCELLENT':
      return dict.gradeEXCELLENT
    case 'GOOD':
      return dict.gradeGOOD
    case 'FAIR':
      return dict.gradeFAIR
    case 'AVERAGE':
      return dict.gradeAVERAGE
    case 'WEAK':
      return dict.gradeWEAK
    default:
      return null
  }
}

function Section({ cap, children }: { cap: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid border border-ga-line p-3.5">
      <h2 className="ga-ui m-0 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ga-muted">{cap}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ga-line py-1.5 last:border-b-0">
      <span className="text-[13px] text-ga-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold text-ga-ink">{value}</span>
    </div>
  )
}

export function ReportSheet({ dict, lang, payload, header, preview = false }: ReportSheetProps) {
  const none = dict.noValue
  const periodLabel = payload.period === 'FINAL' ? dict.periodFINAL : dict.periodMIDTERM
  const orgName = header.orgName ?? payload.org?.name ?? null
  const logoUrl = header.orgLogoUrl ?? payload.org?.logoUrl ?? null

  return (
    <article className="mx-auto w-full max-w-[820px] bg-ga-card px-6 py-7 text-ga-ink sm:px-9 sm:py-10">
      {header.revoked ? (
        <p role="status" className="m-0 mb-5 border border-ga-red bg-ga-red-soft px-3.5 py-2.5 text-[13px] font-semibold text-ga-red">
          {dict.revokedNotice}
        </p>
      ) : null}

      {preview ? (
        <p className="m-0 mb-5 border border-ga-line bg-ga-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ga-muted">
          {dict.previewNotice}
        </p>
      ) : null}

      {/* 1 — đầu trang: co-brand + tên phiếu + kỳ + lớp */}
      <header className="border-b-2 border-ga-ink pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName ?? ''} className="h-11 w-auto object-contain" />
          ) : null}
          <div className="min-w-0">
            <p className="m-0 font-ga-display text-[17px] font-medium text-ga-ink">{orgName ?? 'DeutschFlow'}</p>
            <p className="ga-ui m-0 text-[11px] uppercase tracking-[0.18em] text-ga-muted">
              {orgName ? dict.partnerLine : dict.platformLine}
            </p>
          </div>
        </div>
        <h1 className="m-0 mt-4 font-ga-display text-[23px] font-medium leading-tight text-ga-ink">{dict.docTitle}</h1>
        <p className="ga-ui m-0 mt-1 text-[13.5px] text-ga-muted">{periodLabel}</p>
        <dl className="m-0 mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          <MetaPair label={dict.classLabel} value={payload.class?.name ?? none} />
          {payload.class?.level ? <MetaPair label={dict.levelLabel} value={payload.class.level} /> : null}
          <MetaPair label={dict.teacherLabel} value={payload.class?.primaryTeacherName ?? none} />
          <MetaPair label={dict.issuedAtLabel} value={formatDate(header.issuedAt, lang, none)} />
        </dl>
      </header>

      {/* 2 — học viên: tên + ngày vào lớp. KHÔNG email, KHÔNG ngày sinh (R4). */}
      <Section cap={dict.studentCap}>
        <Row label={dict.studentNameLabel} value={header.studentName || payload.student?.name || none} />
        <Row label={dict.joinedAtLabel} value={formatDate(payload.student?.joinedAt, lang, none)} />
      </Section>

      {/* 3 — bốn kỹ năng: thanh 0–10 + điểm + xếp loại */}
      <Section cap={dict.skillsCap}>
        <div className="flex flex-col gap-2.5">
          {(payload.skills ?? []).map((row) => {
            const pct = row.score == null ? 0 : Math.min(Math.max(row.score, 0), 10) * 10
            const grade = gradeLabel(dict, row.grade)
            return (
              <div key={row.code} className="flex items-center gap-3">
                <span className="w-[104px] shrink-0 text-[13px] text-ga-muted">{skillLabel(dict, row)}</span>
                <span className="h-2 flex-1 overflow-hidden bg-ga-line" aria-hidden>
                  <span className="block h-full bg-ga-accent" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right text-[13px] font-semibold text-ga-ink">
                  {formatScore(row.score, lang, none)}
                </span>
                <span className="w-[112px] shrink-0 text-right text-[12.5px] text-ga-muted">{grade ?? none}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 border-t border-ga-line pt-2.5">
          <Row
            label={dict.overallLabel}
            value={
              <>
                {formatScore(payload.overall?.score ?? null, lang, none)}
                {gradeLabel(dict, payload.overall?.grade ?? null)
                  ? ` · ${gradeLabel(dict, payload.overall?.grade ?? null)}`
                  : ''}
              </>
            }
          />
        </div>
      </Section>

      {/* 4 — chuyên cần: "chưa điểm danh ≠ vắng" giữ nguyên ngữ nghĩa, nói thành lời dưới bảng */}
      {payload.attendance ? (
        <Section cap={dict.attendanceCap}>
          <Row label={dict.attendancePresent} value={payload.attendance.present} />
          <Row label={dict.attendanceLate} value={payload.attendance.late} />
          <Row label={dict.attendanceAbsent} value={payload.attendance.absent} />
          <Row label={dict.attendanceRecorded} value={payload.attendance.recorded} />
          <Row
            label={dict.attendanceRate}
            value={payload.attendance.ratePct == null ? none : `${payload.attendance.ratePct}%`}
          />
          <p className="ga-ui m-0 mt-2 text-[12px] leading-relaxed text-ga-muted">{dict.attendanceNote}</p>
        </Section>
      ) : null}

      {/* 5 — bài tập: chỉ điểm GIÁO VIÊN đã chốt; không điểm AI thô, không nội dung bài (R4) */}
      {payload.assignments ? (
        <Section cap={dict.assignmentsCap}>
          <Row label={dict.assignmentsAvg} value={formatScore(payload.assignments.avgScore, lang, none)} />
          {payload.assignments.confirmed == null ? null : (
            <Row label={dict.assignmentsConfirmed} value={payload.assignments.confirmed} />
          )}
          {payload.assignments.awaitingTeacher == null ? null : (
            <Row label={dict.assignmentsAwaiting} value={payload.assignments.awaitingTeacher} />
          )}
        </Section>
      ) : null}

      {/* 6 — mục tiêu giáo trình (ẩn hẳn khi lớp chưa gắn giáo trình) */}
      {payload.objectives ? (
        <Section cap={dict.objectivesCap}>
          <Row label={dict.objectivesAchieved} value={payload.objectives.achieved} />
          <Row label={dict.objectivesNeedsPractice} value={payload.objectives.needsPractice} />
          <Row label={dict.objectivesNotAssessed} value={payload.objectives.notAssessed} />
          <Row label={dict.objectivesTotal} value={payload.objectives.total} />
          {payload.objectives.needsPracticeItems?.length ? (
            <div className="mt-2.5">
              <p className="ga-ui m-0 mb-1 text-[12px] font-semibold text-ga-ink">
                {dict.objectivesNeedsPracticeHeading}
              </p>
              <ul className="m-0 list-disc space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-ga-muted">
                {payload.objectives.needsPracticeItems.map((item, i) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* 7 — tự học ngoài lớp, TỔNG HỢP (R4): không liệt kê từng phiên */}
      {payload.selfStudy ? (
        <Section cap={dict.selfStudyCap}>
          <Row label={dict.selfStudySpeakingSessions} value={payload.selfStudy.speakingSessions} />
          <Row
            label={dict.selfStudySpeakingMinutes}
            value={`${payload.selfStudy.speakingMinutes} ${dict.minutesUnit}`}
          />
          <Row label={dict.selfStudyVocabMastered} value={payload.selfStudy.vocabMastered} />
          <Row label={dict.selfStudyLessonsCompleted} value={payload.selfStudy.lessonsCompleted} />
        </Section>
      ) : null}

      {/* 8 — nhận xét NGUYÊN VĂN của giáo viên (§5 mặc định: không dịch máy) */}
      <Section cap={dict.commentCap}>
        <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ga-ink">
          {payload.teacherComment ?? dict.noComment}
        </p>
      </Section>

      {/* 9 — điều kiện chứng nhận: CHỈ kỳ cuối khoá (R10) */}
      {payload.certificate ? (
        <Section cap={dict.certificateCap}>
          <p className="m-0 text-[13.5px] font-semibold text-ga-ink">
            {payload.certificate.eligible ? dict.certificateEligible : dict.certificateNotEligible}
          </p>
          {typeof payload.certificate.minAvgScore === 'number'
            && typeof payload.certificate.minAttendancePct === 'number' ? (
            <p className="ga-ui m-0 mt-1.5 text-[12.5px] leading-relaxed text-ga-muted">
              {fillReport(dict.certificateThresholds, {
                minAvg: payload.certificate.minAvgScore,
                minAttendance: payload.certificate.minAttendancePct,
              })}
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* 10 — xác thực + hai dòng kẻ ký tay cho ai muốn đóng dấu (R7) */}
      {preview ? null : (
        <>
          <Section cap={dict.verifyCap}>
            <Row label={dict.verificationCodeLabel} value={header.verificationCode ?? none} />
            <Row label={dict.issuedByLabel} value={header.issuedByName ?? none} />
            {header.verifyUrl ? (
              <p className="ga-ui m-0 mt-2 break-words text-[12px] text-ga-muted">
                {fillReport(dict.verifyAt, { url: header.verifyUrl.replace(/^https?:\/\//, '') })}
              </p>
            ) : null}
            {header.tokenExpiresAt ? (
              <p className="ga-ui m-0 mt-1 text-[12px] text-ga-muted">
                {fillReport(dict.expiresAt, { date: formatDate(header.tokenExpiresAt, lang, none) })}
              </p>
            ) : null}
          </Section>

          <div className="mt-9 grid grid-cols-2 gap-8 break-inside-avoid">
            <SignatureLine label={dict.signTeacher} />
            <SignatureLine label={dict.signOrg} />
          </div>

          <p className="ga-ui m-0 mt-6 text-[11.5px] leading-relaxed text-ga-muted">{dict.privacyNote}</p>
        </>
      )}
    </article>
  )
}

function MetaPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="m-0 shrink-0 text-ga-muted">{label}</dt>
      <dd className="m-0 min-w-0 font-semibold text-ga-ink">{value}</dd>
    </div>
  )
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-11 border-b border-ga-ink" />
      <p className="ga-ui m-0 mt-1 text-center text-[12px] text-ga-muted">{label}</p>
    </div>
  )
}
