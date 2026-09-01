import api from '@/lib/api'

/**
 * Nhập PDF thành nội dung giảng dạy — client cho luồng hai bước.
 *
 * Bước 1 (`startPreview` → `waitForPreview`) chỉ PHÂN TÍCH: trả về bản nháp để giáo viên xem và
 * sửa, không ghi gì vào lớp. Bước 2 (`commitImport`) mới tạo module và buổi học, và chỉ tạo đúng
 * bản nháp mà giáo viên gửi lại.
 *
 * Toàn bộ phân tích chạy trên máy chủ của chính hệ thống — giáo trình mẫu là dữ liệu đóng gói sẵn,
 * sách lạ thì đọc mục lục bằng OCR nội bộ. Không có dịch vụ AI bên ngoài nào trong đường đi này.
 */

export type ImportSource = 'TEMPLATE' | 'OCR'
export type DraftModuleKind = 'CHAPTER' | 'REVIEW'
export type OnDuplicateModule = 'FAIL' | 'SKIP' | 'RENAME'

export interface CurriculumTemplateSummary {
  id: string
  title: string
  level: string
  chapterCount: number
  reviewCount: number
  defaultSessionsPerChapter: number
  defaultUnitsPerSession: number
}

export interface DraftKnowledgePoint {
  text: string
  skillTag: string | null
  contentTag: string | null
}

export interface DraftCanDoStatement {
  text: string
  cefrLevel: string | null
  skillTag: string | null
}

export interface DraftLesson {
  clientId: string
  title: string
  cefrLevel: string | null
  estimatedUnits: number | null
  plannedDate: string | null
  sourcePageFrom: number | null
  sourcePageTo: number | null
  knowledgePoints: DraftKnowledgePoint[]
  canDoStatements: DraftCanDoStatement[]
}

export interface DraftModule {
  clientId: string
  title: string
  kind: DraftModuleKind
  sourcePageFrom: number | null
  sourcePageTo: number | null
  lessons: DraftLesson[]
}

export interface CurriculumImportPreview {
  sourceMaterialId: number | null
  sourceFileName: string | null
  detectedTitle: string | null
  detectedLevel: string | null
  source: ImportSource
  warnings: string[]
  modules: DraftModule[]
}

export interface CurriculumImportConfig {
  /** Giáo trình mẫu để mở rộng; bỏ trống = đọc mục lục của chính tài liệu. */
  templateId: string | null
  materialId: number
  cefrLevel: string
  sessionsPerChapter: number
  estimatedUnitsPerSession: number
  separateReviewSessions: boolean
  deepScan: boolean
  /** Không bắt buộc. Có ngày bắt đầu thì các buổi nhận ngày từ lịch lớp; không thì để trống. */
  startDate: string | null
}

export interface CurriculumImportCommitResult {
  modulesCreated: number
  lessonsCreated: number
  moduleIds: number[]
  skippedModuleTitles: string[]
  /** true khi lần gọi này khớp một lần nhập trước đó — không có bản ghi mới nào được tạo. */
  replayed: boolean
}

/** GET danh sách giáo trình mẫu hệ thống hỗ trợ. */
export async function listCurriculumTemplates(): Promise<CurriculumTemplateSummary[]> {
  const res = await api.get<CurriculumTemplateSummary[]>('/v2/teacher/curriculum-templates')
  return res.data ?? []
}

/** POST bắt đầu phân tích. Trả jobId; bản nháp lấy qua {@link waitForPreview}. */
export async function startCurriculumPreview(
  classId: number,
  config: CurriculumImportConfig,
): Promise<string> {
  const res = await api.post<{ jobId: string }>(
    `/v2/teacher/classes/${classId}/curriculum-imports/preview`,
    config,
  )
  return res.data.jobId
}

export type PreviewJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface PreviewJob {
  jobId: string
  status: PreviewJobStatus
  resultPayload: string | null
  errorMessage: string | null
}

export class CurriculumImportError extends Error {}

const POLL_INTERVAL_MS = 1200
/** Đọc mục lục bằng OCR có thể mất vài chục giây trên máy chủ bận. */
const DEFAULT_TIMEOUT_MS = 180_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll một job phân tích tới khi xong rồi trả bản nháp.
 *
 * Dùng endpoint riêng dưới `/curriculum-imports/jobs/` chứ không phải `/async-jobs/{id}` chung:
 * bản nháp chứa kế hoạch giảng dạy của một lớp, nên endpoint riêng có kiểm tra chủ sở hữu job.
 */
export async function waitForPreview(
  classId: number,
  jobId: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<CurriculumImportPreview> {
  const deadline = Date.now() + (options?.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  for (;;) {
    if (options?.signal?.aborted) throw new CurriculumImportError('aborted')

    const { data } = await api.get<PreviewJob>(
      `/v2/teacher/classes/${classId}/curriculum-imports/jobs/${jobId}`,
    )

    if (data.status === 'COMPLETED') {
      if (!data.resultPayload) {
        throw new CurriculumImportError('Phân tích xong nhưng không có kết quả.')
      }
      return JSON.parse(data.resultPayload) as CurriculumImportPreview
    }
    if (data.status === 'FAILED') {
      throw new CurriculumImportError(data.errorMessage || 'Phân tích tài liệu thất bại.')
    }
    if (Date.now() >= deadline) {
      throw new CurriculumImportError('Quá thời gian chờ phân tích tài liệu.')
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

/**
 * POST ghi bản nháp đã duyệt.
 *
 * `idempotencyKey` phải do client sinh MỘT LẦN cho mỗi lần nhập và giữ nguyên qua mọi lần thử lại:
 * đó là thứ khiến một request timeout giữa chừng không tạo ra bản sao thứ hai của cả giáo trình.
 */
export async function commitCurriculumImport(
  classId: number,
  body: {
    sourceMaterialId: number | null
    idempotencyKey: string
    onDuplicateModule: OnDuplicateModule
    modules: DraftModule[]
  },
): Promise<CurriculumImportCommitResult> {
  const res = await api.post<CurriculumImportCommitResult>(
    `/v2/teacher/classes/${classId}/curriculum-imports/commit`,
    body,
  )
  return res.data
}

/** Khoá chống nhập trùng cho một lần mở wizard. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Tổng số buổi và số tiết của một bản nháp — dùng cho dòng tóm tắt và cảnh báo lệch dự kiến. */
export function draftTotals(modules: DraftModule[]): {
  modules: number
  lessons: number
  units: number
} {
  let lessons = 0
  let units = 0
  for (const m of modules) {
    for (const l of m.lessons) {
      lessons += 1
      units += l.estimatedUnits ?? 0
    }
  }
  return { modules: modules.length, lessons, units }
}
