'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { TkModal, GaBtn, ErrorBanner } from '@/components/ui-v2'
import { listMaterials, uploadMaterial, type Material } from '@/lib/materialApi'
import {
  commitCurriculumImport,
  draftTotals,
  listCurriculumTemplates,
  newIdempotencyKey,
  startCurriculumPreview,
  waitForPreview,
  type CurriculumImportPreview,
  type CurriculumTemplateSummary,
  type DraftModule,
  type OnDuplicateModule,
} from '@/lib/curriculumImportApi'
import {
  allSelected,
  applySelection,
  ImportPreviewEditor,
  type DraftSelection,
} from './ImportPreviewEditor'

/**
 * Sáu trạng thái của luồng nhập. `analyzing` và `importing` là hai giai đoạn CHỜ khác nhau về hệ
 * quả: huỷ ở `analyzing` không mất gì, còn `importing` đã bắt đầu ghi nên không có nút huỷ.
 */
type Step = 'source' | 'config' | 'analyzing' | 'preview' | 'importing' | 'done'

const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const labelCls = 'ga-ui mb-1 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted'
const fieldCls =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

/**
 * Nhập PDF thành kế hoạch giảng dạy.
 *
 * Wizard chỉ gọi `commit` khi giáo viên bấm nút xác nhận ở bước xem trước; mọi thứ trước đó chỉ đọc.
 * Khoá chống trùng được sinh MỘT LẦN cho mỗi lần mở, nên bấm lại sau lỗi mạng sẽ phát lại kết quả
 * cũ thay vì nhập giáo trình lần thứ hai.
 */
export function CurriculumImportWizard({
  classId,
  open,
  onClose,
  onImported,
}: {
  classId: number
  open: boolean
  onClose: () => void
  onImported: (result: { modulesCreated: number; lessonsCreated: number; firstModuleId?: number }) => void
}) {
  const t = useTranslations('v2.teacher.tcChecklist.import')

  const [step, setStep] = useState<Step>('source')
  const [error, setError] = useState('')

  // ── Nguồn ───────────────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [materialId, setMaterialId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  // ── Cấu hình ────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<CurriculumTemplateSummary[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [cefrLevel, setCefrLevel] = useState('A1')
  const [sessionsPerChapter, setSessionsPerChapter] = useState(3)
  const [unitsPerSession, setUnitsPerSession] = useState(4)
  const [separateReviews, setSeparateReviews] = useState(true)
  const [startDate, setStartDate] = useState('')

  // ── Bản nháp ────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<CurriculumImportPreview | null>(null)
  // Job đã sinh ra bản nháp — commit phải dẫn lại nó để máy chủ tự xác định nguồn tài liệu.
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [modules, setModules] = useState<DraftModule[]>([])
  const [selection, setSelection] = useState<DraftSelection>({ modules: {}, lessons: {} })
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicateModule>('FAIL')
  const [result, setResult] = useState<{ modulesCreated: number; lessonsCreated: number } | null>(null)

  // Một khoá cho cả lần mở wizard: thử lại sau timeout phải phát lại kết quả, không nhập lần hai.
  const idempotencyKey = useRef(newIdempotencyKey())
  const abort = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStep('source')
    setError('')
    setPreview(null)
    setPreviewJobId(null)
    setModules([])
    setSelection({ modules: {}, lessons: {} })
    setResult(null)
    setOnDuplicate('FAIL')
    idempotencyKey.current = newIdempotencyKey()
  }, [])

  useEffect(() => {
    if (!open) {
      abort.current?.abort()
      abort.current = null
      return
    }
    reset()
    setLoadingMaterials(true)
    Promise.all([listMaterials(), listCurriculumTemplates()])
      .then(([mats, tpls]) => {
        const pdfs = mats.filter((m) => m.kind === 'PDF' && m.status === 'ACTIVE')
        setMaterials(pdfs)
        setTemplates(tpls)
        setMaterialId((cur) => cur ?? pdfs[0]?.id ?? null)
        if (tpls.length > 0) {
          setTemplateId(tpls[0].id)
          setSessionsPerChapter(tpls[0].defaultSessionsPerChapter)
          setUnitsPerSession(tpls[0].defaultUnitsPerSession)
          setCefrLevel(tpls[0].level)
        }
      })
      .catch((e) => setError(apiMessage(e)))
      .finally(() => setLoadingMaterials(false))
  }, [open, reset])

  const totals = useMemo(() => draftTotals(applySelection(modules, selection)), [modules, selection])

  const expected = useMemo(() => {
    const tpl = templates.find((x) => x.id === templateId)
    if (!tpl) return null
    const mods = tpl.chapterCount + (separateReviews ? tpl.reviewCount : 0)
    const lessons = tpl.chapterCount * sessionsPerChapter + (separateReviews ? tpl.reviewCount : 0)
    return { modules: mods, lessons }
  }, [templates, templateId, sessionsPerChapter, separateReviews])

  const mismatch =
    expected != null && (totals.modules !== expected.modules || totals.lessons !== expected.lessons)

  // ── Hành động ───────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t('errorTooLarge', { mb: Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) }))
      return
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError(t('errorNotPdf'))
      return
    }
    setUploading(true)
    setError('')
    try {
      const created = await uploadMaterial(file, file.name.replace(/\.pdf$/i, ''), 'PERSONAL')
      setMaterials((prev) => [created, ...prev])
      setMaterialId(created.id)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setUploading(false)
    }
  }

  async function runPreview() {
    if (materialId == null) return
    setStep('analyzing')
    setError('')
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      const jobId = await startCurriculumPreview(classId, {
        templateId: templateId || null,
        materialId,
        cefrLevel,
        sessionsPerChapter,
        estimatedUnitsPerSession: unitsPerSession,
        separateReviewSessions: separateReviews,
        deepScan: false,
        startDate: startDate || null,
      })
      const p = await waitForPreview(classId, jobId, { signal: ctrl.signal })
      // Re-check after the await: cancelling while the last poll is in flight would otherwise let a
      // COMPLETED response come back and yank the teacher into the preview they just backed out of.
      if (ctrl.signal.aborted) return
      setPreviewJobId(jobId)
      setPreview(p)
      setModules(p.modules)
      setSelection(allSelected(p.modules))
      setStep('preview')
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(apiMessage(e))
      setStep('config')
    } finally {
      abort.current = null
    }
  }

  async function runCommit() {
    const chosen = applySelection(modules, selection)
    if (chosen.length === 0 || !previewJobId) return
    setStep('importing')
    setError('')
    try {
      const res = await commitCurriculumImport(classId, {
        previewJobId,
        idempotencyKey: idempotencyKey.current,
        onDuplicateModule: onDuplicate,
        modules: chosen,
      })
      setResult(res)
      setStep('done')
      onImported({
        modulesCreated: res.modulesCreated,
        lessonsCreated: res.lessonsCreated,
        firstModuleId: res.moduleIds?.[0],
      })
    } catch (e) {
      // Quay lại bước xem trước với CÙNG khoá chống trùng: bấm lại là thử lại đúng lần nhập đó.
      setError(apiMessage(e))
      setStep('preview')
    }
  }

  // ── Chân modal ──────────────────────────────────────────────────────────

  const footer = (() => {
    if (step === 'source') {
      return (
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            {t('cancel')}
          </GaBtn>
          <GaBtn variant="primary" disabled={materialId == null || uploading} onClick={() => setStep('config')}>
            {t('next')}
          </GaBtn>
        </>
      )
    }
    if (step === 'config') {
      return (
        <>
          <GaBtn variant="ghost" onClick={() => setStep('source')}>
            {t('back')}
          </GaBtn>
          <GaBtn variant="primary" disabled={materialId == null} onClick={runPreview}>
            {t('analyze')}
          </GaBtn>
        </>
      )
    }
    if (step === 'analyzing') {
      return (
        <GaBtn
          variant="ghost"
          onClick={() => {
            abort.current?.abort()
            setStep('config')
          }}
        >
          {t('cancel')}
        </GaBtn>
      )
    }
    if (step === 'preview') {
      return (
        <>
          <GaBtn variant="ghost" onClick={() => setStep('config')}>
            {t('back')}
          </GaBtn>
          <GaBtn variant="primary" disabled={totals.lessons === 0 || !previewJobId} onClick={runCommit}>
            {t('importAll', { modules: totals.modules, lessons: totals.lessons })}
          </GaBtn>
        </>
      )
    }
    if (step === 'importing') {
      return (
        <GaBtn variant="primary" disabled>
          <Loader2 size={15} className="animate-spin" /> {t('importing')}
        </GaBtn>
      )
    }
    return (
      <GaBtn variant="primary" onClick={onClose}>
        {t('close')}
      </GaBtn>
    )
  })()

  return (
    <TkModal
      open={open}
      onOpenChange={(v) => {
        if (!v && step !== 'importing') onClose()
      }}
      size="lg"
      title={t('title')}
      description={t('subtitle')}
      footer={footer}
    >
      {/* Trạng thái xử lý được đọc lên cho trình đọc màn hình, không chỉ hiện spinner. */}
      <p aria-live="polite" className="sr-only">
        {step === 'analyzing' ? t('analyzing') : step === 'importing' ? t('importing') : ''}
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {step === 'source' && (
        <section aria-labelledby="ci-source-h">
          <h3 id="ci-source-h" className="ga-ui mb-3 text-[14px] font-semibold text-ga-ink">
            {t('stepSource')}
          </h3>

          {loadingMaterials ? (
            <p className="ga-ui text-[13px] text-ga-muted">{t('loading')}</p>
          ) : materials.length === 0 ? (
            <p className="ga-ui mb-3 text-[13px] text-ga-muted">{t('noPdfMaterials')}</p>
          ) : (
            <div className="mb-4">
              <label className={labelCls} htmlFor="ci-material">
                {t('materialLabel')}
              </label>
              <select
                id="ci-material"
                className={fieldCls}
                value={materialId ?? ''}
                onChange={(e) => setMaterialId(e.target.value ? Number(e.target.value) : null)}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className={labelCls}>{t('uploadLabel')}</span>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleUpload(f)
                e.target.value = ''
              }}
            />
            <GaBtn variant="ghost" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? t('uploading') : t('uploadButton')}
            </GaBtn>
            <p className="ga-ui mt-2 text-[12px] text-ga-subtle">{t('uploadHint')}</p>
          </div>
        </section>
      )}

      {step === 'config' && (
        <section aria-labelledby="ci-config-h" className="flex flex-col gap-4">
          <h3 id="ci-config-h" className="ga-ui text-[14px] font-semibold text-ga-ink">
            {t('stepConfig')}
          </h3>

          <div>
            <label className={labelCls} htmlFor="ci-template">
              {t('templateLabel')}
            </label>
            <select
              id="ci-template"
              className={fieldCls}
              value={templateId}
              onChange={(e) => {
                const id = e.target.value
                setTemplateId(id)
                const tpl = templates.find((x) => x.id === id)
                if (tpl) {
                  setSessionsPerChapter(tpl.defaultSessionsPerChapter)
                  setUnitsPerSession(tpl.defaultUnitsPerSession)
                  setCefrLevel(tpl.level)
                }
              }}
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {t('templateOption', {
                    title: tpl.title,
                    chapters: tpl.chapterCount,
                    reviews: tpl.reviewCount,
                  })}
                </option>
              ))}
              <option value="">{t('templateFromDocument')}</option>
            </select>
            <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">
              {templateId ? t('templateHint') : t('documentHint')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="ci-cefr">
                {t('cefrLabel')}
              </label>
              <select id="ci-cefr" className={fieldCls} value={cefrLevel} onChange={(e) => setCefrLevel(e.target.value)}>
                {CEFR_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="ci-sessions">
                {t('sessionsPerChapterLabel')}
              </label>
              <input
                id="ci-sessions"
                type="number"
                min={1}
                max={10}
                className={fieldCls}
                value={sessionsPerChapter}
                onChange={(e) => setSessionsPerChapter(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="ci-units">
                {t('unitsPerSessionLabel')}
              </label>
              <input
                id="ci-units"
                type="number"
                min={1}
                max={20}
                className={fieldCls}
                value={unitsPerSession}
                onChange={(e) => setUnitsPerSession(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          <label className="ga-ui flex items-center gap-2 text-[13px] text-ga-ink">
            <input
              type="checkbox"
              checked={separateReviews}
              onChange={(e) => setSeparateReviews(e.target.checked)}
              className="h-4 w-4 accent-ga-accent"
            />
            {t('separateReviewsLabel')}
          </label>

          <div>
            <label className={labelCls} htmlFor="ci-start">
              {t('startDateLabel')}
            </label>
            <input
              id="ci-start"
              type="date"
              className={fieldCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">{t('startDateHint')}</p>
          </div>

          {expected && (
            <p className="ga-ui text-[12.5px] text-ga-muted">
              {t('expectedSummary', { modules: expected.modules, lessons: expected.lessons })}
            </p>
          )}
        </section>
      )}

      {step === 'analyzing' && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 size={26} className="animate-spin text-ga-accent" />
          <p className="ga-ui text-[13.5px] text-ga-ink">{t('analyzing')}</p>
          <p className="ga-ui text-[12px] text-ga-subtle">{t('analyzingHint')}</p>
        </div>
      )}

      {step === 'preview' && preview && (
        <section aria-labelledby="ci-preview-h" className="flex flex-col gap-3">
          <h3 id="ci-preview-h" className="ga-ui text-[14px] font-semibold text-ga-ink">
            {t('stepPreview')}
          </h3>

          <p className="ga-ui text-[13px] text-ga-ink">
            <FileText size={14} className="mr-1 inline align-[-2px] text-ga-subtle" />
            {t('previewSummary', {
              modules: totals.modules,
              lessons: totals.lessons,
              units: totals.units,
            })}
          </p>

          {mismatch && expected && (
            <p role="status" className="ga-ui flex items-start gap-2 rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[12.5px] text-ga-ink">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ga-subtle" />
              {t('mismatchWarning', {
                expectedModules: expected.modules,
                expectedLessons: expected.lessons,
                modules: totals.modules,
                lessons: totals.lessons,
              })}
            </p>
          )}

          {preview.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-ga border border-ga-line bg-ga-surface px-3 py-2">
              {preview.warnings.map((w, i) => (
                <li key={i} className="ga-ui flex items-start gap-2 text-[12.5px] text-ga-ink">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-ga-subtle" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className={labelCls} htmlFor="ci-dup">
              {t('onDuplicateLabel')}
            </label>
            <select
              id="ci-dup"
              className={fieldCls}
              value={onDuplicate}
              onChange={(e) => setOnDuplicate(e.target.value as OnDuplicateModule)}
            >
              <option value="FAIL">{t('onDuplicateFail')}</option>
              <option value="SKIP">{t('onDuplicateSkip')}</option>
              <option value="RENAME">{t('onDuplicateRename')}</option>
            </select>
          </div>

          <ImportPreviewEditor
            modules={modules}
            selection={selection}
            onChange={setModules}
            onSelectionChange={setSelection}
          />
        </section>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 size={26} className="animate-spin text-ga-accent" />
          <p className="ga-ui text-[13.5px] text-ga-ink">{t('importing')}</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-10">
          <CheckCircle2 size={26} className="text-ga-accent" />
          <p className="ga-ui text-[13.5px] text-ga-ink">
            {t('importedSummary', {
              modules: result.modulesCreated,
              lessons: result.lessonsCreated,
            })}
          </p>
        </div>
      )}
    </TkModal>
  )
}
