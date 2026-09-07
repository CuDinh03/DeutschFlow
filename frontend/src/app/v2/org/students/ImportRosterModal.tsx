'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { importRoster, listClasses, type OrgClass, type RosterImportResult } from '@/lib/orgApi'
import { downloadTextFile, parseRosterCsv, rosterErrorsCsv, rosterTemplateCsv, type RosterParse } from '@/lib/orgCsv'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Nhập danh sách học viên từ CSV (PR-A5 / BF-07, 07/09/2026).
 *
 * Backend `POST /org/students/import` đã có từ lâu (`orgApi.importRoster`) nhưng chưa có màn nào gọi —
 * chủ trung tâm phải nhập từng học viên hoặc nhờ kỹ thuật. Modal này: tải file mẫu → chọn file → xem
 * trước (đếm dòng, báo email sai sớm) → gắn lớp tuỳ chọn → nhập → kết quả từng dòng + tải CSV lỗi.
 * Mỗi dòng chạy transaction riêng ở backend nên dòng hỏng không kéo cả batch; nhập lại không tạo trùng.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'
const PREVIEW_ROWS = 5
const CLASS_PAGE = 50

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'utf-8')
  })
}

export function ImportRosterModal({ onClose, onImported }: { onClose: () => void; onImported: (result: RosterImportResult) => void }) {
  const t = useTranslations('v2.org.students.importModal')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<RosterParse | null>(null)
  const [parseError, setParseError] = useState('')
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [classesTruncated, setClassesTruncated] = useState(false)
  const [classId, setClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RosterImportResult | null>(null)

  useEffect(() => {
    let active = true
    listClasses(0, CLASS_PAGE)
      .then((p) => {
        if (!active) return
        setClasses(p.content ?? [])
        setClassesTruncated(p.last === false)
      })
      // Lớp là tuỳ chọn — lỗi tải lớp không chặn nhập học viên.
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const onFile = async (f: File | null) => {
    setFile(f)
    setParsed(null)
    setParseError('')
    setResult(null)
    setError('')
    if (!f) return
    try {
      const p = parseRosterCsv(await readFileText(f))
      if (p.rows.length === 0) setParseError(t('emptyFile'))
      else setParsed(p)
    } catch {
      setParseError(t('readError'))
    }
  }

  const submit = async () => {
    if (!file || !parsed) return
    setSubmitting(true)
    setError('')
    try {
      const r = await importRoster(file, classId ? Number(classId) : undefined)
      setResult(r)
      onImported(r)
      toast.success(t('done', { created: r.created, linked: r.linked, failed: r.failed }))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const rows = parsed?.rows ?? []

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('title')}
      description={t('description')}
      footer={
        result ? (
          <GaBtn variant="primary" onClick={onClose}>{t('close')}</GaBtn>
        ) : (
          <>
            <GaBtn variant="ghost" onClick={onClose}>{t('cancel')}</GaBtn>
            <GaBtn variant="primary" loading={submitting} disabled={!parsed || submitting} onClick={submit} data-testid="roster-submit">
              {t('submit', { count: rows.length })}
            </GaBtn>
          </>
        )
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      {!result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="block flex-1">
              <GaCap>{t('fileLabel')}</GaCap>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={t('fileLabel')}
                data-testid="roster-file-input"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                className={INPUT_CLS}
              />
            </label>
            <GaBtn variant="ghost" size="sm" onClick={() => downloadTextFile('mau-hoc-vien.csv', rosterTemplateCsv())}>
              <Download size={14} /> {t('template')}
            </GaBtn>
          </div>
          {parseError && <p className="ga-ui text-ga-caption text-ga-red">{parseError}</p>}

          {parsed && (
            <div className="border border-ga-line bg-ga-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ga-line bg-ga-bg px-3 py-2">
                <GaCap>{t('preview', { count: rows.length })}</GaCap>
                {parsed.invalidEmails > 0 && (
                  <span className="ga-ui text-ga-caption text-ga-red">{t('invalidEmails', { count: parsed.invalidEmails })}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-ga-small">
                  <thead>
                    <tr className="text-left text-ga-muted">
                      <th className="px-3 py-1.5 font-semibold">{t('colLine')}</th>
                      <th className="px-3 py-1.5 font-semibold">{t('colEmail')}</th>
                      <th className="px-3 py-1.5 font-semibold">{t('colName')}</th>
                      <th className="px-3 py-1.5 font-semibold">{t('colPhone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={r.line} className="border-t border-ga-line">
                        {/* Số dòng vật lý trong tệp — người dùng dò lại đúng chỗ trong Excel khi có lỗi. */}
                        <td className="px-3 py-1.5 font-mono text-ga-muted tabular-nums">{r.line}</td>
                        <td className="px-3 py-1.5 font-mono text-ga-ink">{r.email || '—'}</td>
                        <td className="px-3 py-1.5 text-ga-ink">{r.displayName || '—'}</td>
                        <td className="px-3 py-1.5 text-ga-muted">{r.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > PREVIEW_ROWS && (
                <p className="ga-ui border-t border-ga-line px-3 py-1.5 text-ga-caption text-ga-muted">{t('previewMore', { count: rows.length - PREVIEW_ROWS })}</p>
              )}
            </div>
          )}

          <label className="block">
            <GaCap>{t('classLabel')}</GaCap>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={INPUT_CLS} aria-label={t('classLabel')}>
              <option value="">{t('classNone')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {classesTruncated && <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">{t('classTruncated')}</p>}
          </label>

          <ul className="ga-ui list-disc space-y-1 pl-5 text-ga-caption text-ga-muted">
            <li>{t('idempotentNote')}</li>
            <li>{t('planNote')}</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4" data-testid="roster-result">
          <GaCap>{t('resultTitle')}</GaCap>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([
              ['total', result.total], ['created', result.created], ['linked', result.linked], ['enrolled', result.enrolled], ['failed', result.failed],
            ] as const).map(([k, v]) => (
              <div key={k} className="border border-ga-line bg-ga-card px-3 py-2">
                <dt className="ga-ui text-ga-caption uppercase text-ga-muted">{t(k)}</dt>
                <dd className={`font-ga-display text-ga-stat-m ${k === 'failed' && v > 0 ? 'text-ga-red' : 'text-ga-ink'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border border-ga-line bg-ga-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ga-line bg-ga-bg px-3 py-2">
              <GaCap>{t('errorsTitle')}</GaCap>
              {result.errors.length > 0 && (
                <GaBtn variant="ghost" size="sm" onClick={() => downloadTextFile('loi-nhap-hoc-vien.csv', rosterErrorsCsv(result.errors))}>
                  <Download size={14} /> {t('downloadErrors')}
                </GaBtn>
              )}
            </div>
            {result.errors.length === 0 ? (
              <p className="ga-ui px-3 py-3 text-ga-small text-ga-muted">{t('noErrors')}</p>
            ) : (
              <ul className="max-h-56 overflow-auto px-3 py-2 text-ga-small text-ga-red">
                {result.errors.map((e, i) => <li key={i} className="py-0.5">{e}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </TkModal>
  )
}
