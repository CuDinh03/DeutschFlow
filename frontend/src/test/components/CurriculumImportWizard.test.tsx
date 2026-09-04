/**
 * Tests for the "Nhập PDF thành kế hoạch" wizard.
 *
 * The properties worth locking in are the ones a teacher's data depends on: analysing must never
 * write, a commit must only carry what the teacher ticked, and a retry after a failure must reuse
 * the same idempotency key so the server can recognise it instead of importing twice.
 *
 * next-intl is mocked so labels resolve to their key (queryable), and the API modules are mocked so
 * nothing touches the network.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CurriculumImportWizard } from '@/app/v2/teacher/tc-checklist/CurriculumImportWizard'
import type { CurriculumImportPreview, DraftModule } from '@/lib/curriculumImportApi'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const listMaterials = vi.fn()
const uploadMaterial = vi.fn()
const listCurriculumTemplates = vi.fn()
const startCurriculumPreview = vi.fn()
const waitForPreview = vi.fn()
const commitCurriculumImport = vi.fn()

vi.mock('next-intl', () => ({
  // Labels resolve to "key" or "key:{json args}" so assertions can read interpolated values.
  useTranslations: () => {
    const f = (k: string, args?: Record<string, unknown>) =>
      args ? `${k}:${JSON.stringify(args)}` : k
    ;(f as unknown as { rich: (k: string) => string }).rich = (k: string) => k
    return f
  },
}))

vi.mock('@/lib/api', () => ({
  default: {},
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))

vi.mock('@/lib/materialApi', () => ({
  listMaterials: (...a: unknown[]) => listMaterials(...a),
  uploadMaterial: (...a: unknown[]) => uploadMaterial(...a),
}))

vi.mock('@/lib/curriculumImportApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/curriculumImportApi')>()
  return {
    ...actual,
    listCurriculumTemplates: (...a: unknown[]) => listCurriculumTemplates(...a),
    startCurriculumPreview: (...a: unknown[]) => startCurriculumPreview(...a),
    waitForPreview: (...a: unknown[]) => waitForPreview(...a),
    commitCurriculumImport: (...a: unknown[]) => commitCurriculumImport(...a),
  }
})

vi.mock('@/components/ui-v2', () => ({
  TkModal: ({
    open,
    title,
    description,
    children,
    footer,
  }: {
    open?: boolean
    title?: React.ReactNode
    description?: React.ReactNode
    children?: React.ReactNode
    footer?: React.ReactNode
  }) =>
    open ? (
      <div role="dialog" aria-label="import">
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        <div>{footer}</div>
      </div>
    ) : null,
  GaBtn: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ErrorBanner: ({ message }: { message?: React.ReactNode }) => <div role="alert">{message}</div>,
}))

// ─── Fixtures (synthetic — no copyrighted coursebook content) ───────────────

const material = { id: 55, title: 'Testbuch A1', kind: 'PDF', status: 'ACTIVE' }

const template = {
  id: 'testbuch-a1',
  title: 'Testbuch A1',
  level: 'A1',
  chapterCount: 2,
  reviewCount: 1,
  defaultSessionsPerChapter: 3,
  defaultUnitsPerSession: 4,
}

const lesson = (id: string, title: string) => ({
  clientId: id,
  title,
  cefrLevel: 'A1',
  estimatedUnits: 4,
  plannedDate: null,
  sourcePageFrom: 6,
  sourcePageTo: 9,
  knowledgePoints: [{ text: 'Zahlen', skillTag: 'SPRECHEN', contentTag: 'WORTSCHATZ' }],
  canDoStatements: [{ text: 'Ich kann zählen.', cefrLevel: 'A1', skillTag: 'SPRECHEN' }],
})

const modules: DraftModule[] = [
  {
    clientId: 'K01',
    title: 'K01 – Erste Schritte',
    kind: 'CHAPTER',
    sourcePageFrom: 6,
    sourcePageTo: 15,
    lessons: [lesson('K01.L1', 'K01.1 – Einstieg'), lesson('K01.L2', 'K01.2 – Grammatik')],
  },
  {
    clientId: 'P01',
    title: 'P01 – Plattform 1',
    kind: 'REVIEW',
    sourcePageFrom: 16,
    sourcePageTo: 19,
    lessons: [lesson('P01.L1', 'P01.1 – Wiederholung')],
  },
]

const preview: CurriculumImportPreview = {
  sourceMaterialId: 55,
  sourceFileName: 'Testbuch A1',
  detectedTitle: 'Testbuch A1',
  detectedLevel: 'A1',
  source: 'TEMPLATE',
  warnings: [],
  modules,
}

function renderWizard(onImported = vi.fn()) {
  render(
    <CurriculumImportWizard classId={1} open onClose={vi.fn()} onImported={onImported} />,
  )
  return { onImported }
}

/** Walks source → config → analysing → preview. */
async function reachPreview(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('stepSource')
  await user.click(screen.getByRole('button', { name: 'next' }))
  await screen.findByText('stepConfig')
  await user.click(screen.getByRole('button', { name: 'analyze' }))
  await screen.findByText('stepPreview')
}

beforeEach(() => {
  vi.clearAllMocks()
  listMaterials.mockResolvedValue([material])
  listCurriculumTemplates.mockResolvedValue([template])
  startCurriculumPreview.mockResolvedValue('job-1')
  waitForPreview.mockResolvedValue(preview)
  commitCurriculumImport.mockResolvedValue({
    modulesCreated: 2,
    lessonsCreated: 3,
    moduleIds: [11, 12],
    skippedModuleTitles: [],
    replayed: false,
  })
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CurriculumImportWizard', () => {
  it('opens on the source step and offers the library PDFs', async () => {
    renderWizard()

    expect(await screen.findByText('stepSource')).toBeInTheDocument()
    const select = await screen.findByLabelText('materialLabel')
    expect(within(select).getByRole('option', { name: 'Testbuch A1' })).toBeInTheDocument()
  })

  it('shows the configuration defaults from the chosen template', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('stepSource')
    await user.click(screen.getByRole('button', { name: 'next' }))

    expect(await screen.findByText('stepConfig')).toBeInTheDocument()
    expect(screen.getByLabelText('sessionsPerChapterLabel')).toHaveValue(3)
    expect(screen.getByLabelText('unitsPerSessionLabel')).toHaveValue(4)
    expect(screen.getByLabelText('separateReviewsLabel')).toBeChecked()
    expect(screen.getByLabelText('cefrLabel')).toHaveValue('A1')
  })

  it('reports progress while analysing and writes nothing', async () => {
    const user = userEvent.setup()
    // Hold the preview open so the analysing state is observable.
    let release: (v: CurriculumImportPreview) => void = () => {}
    waitForPreview.mockReturnValue(new Promise<CurriculumImportPreview>((r) => (release = r)))
    renderWizard()

    await screen.findByText('stepSource')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(await screen.findByRole('button', { name: 'analyze' }))

    expect(await screen.findAllByText('analyzing')).not.toHaveLength(0)
    expect(commitCurriculumImport).not.toHaveBeenCalled()

    release(preview)
    await screen.findByText('stepPreview')
    expect(commitCurriculumImport).not.toHaveBeenCalled()
  })

  it('cancelling during analysis wins even if the result arrives a moment later', async () => {
    const user = userEvent.setup()
    let release: (v: CurriculumImportPreview) => void = () => {}
    waitForPreview.mockReturnValue(new Promise<CurriculumImportPreview>((r) => (release = r)))
    renderWizard()

    await screen.findByText('stepSource')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(await screen.findByRole('button', { name: 'analyze' }))
    await screen.findAllByText('analyzing')

    await user.click(screen.getByRole('button', { name: 'cancel' }))
    expect(await screen.findByText('stepConfig')).toBeInTheDocument()

    // The in-flight poll comes back COMPLETED after the cancel; it must not drag the teacher into
    // the preview they just backed out of.
    release(preview)
    await waitFor(() => expect(screen.getByText('stepConfig')).toBeInTheDocument())
    expect(screen.queryByText('stepPreview')).not.toBeInTheDocument()
  })

  it('shows the draft totals and every module and session', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    expect(
      screen.getByText('previewSummary:{"modules":2,"lessons":3,"units":12}'),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('K01 – Erste Schritte')).toBeInTheDocument()
    expect(screen.getByDisplayValue('P01 – Plattform 1')).toBeInTheDocument()
  })

  it('shows the source page range of an imported module', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    expect(screen.getAllByText('sourcePages:{"from":6,"to":15}').length).toBeGreaterThan(0)
  })

  it('warns when the result differs from what the template predicted', async () => {
    const user = userEvent.setup()
    // Template predicts 3 modules / 7 sessions; the draft carries 2 / 3.
    renderWizard()
    await reachPreview(user)

    const warning = screen.getByRole('status')
    expect(warning.textContent).toContain('mismatchWarning')
    expect(warning.textContent).toContain('"expectedModules":3')
    expect(warning.textContent).toContain('"modules":2')
  })

  it('surfaces server warnings from the draft', async () => {
    waitForPreview.mockResolvedValue({
      ...preview,
      warnings: ['Máy chủ chưa cài công cụ nhận dạng ký tự (OCR)'],
    })
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    expect(screen.getByText(/chưa cài công cụ nhận dạng/)).toBeInTheDocument()
  })

  it('lets the teacher edit a module title before importing', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    const title = screen.getByDisplayValue('K01 – Erste Schritte')
    await user.clear(title)
    await user.type(title, 'Kapitel 1')
    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalled())
    const sent = commitCurriculumImport.mock.calls[0][1].modules as DraftModule[]
    expect(sent[0].title).toBe('Kapitel 1')
  })

  it('lets the teacher edit a knowledge point and a can-do statement', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    const point = screen.getAllByLabelText('knowledgeHeading 1')[0]
    await user.clear(point)
    await user.type(point, 'Zahlen 1-20')

    const canDo = screen.getAllByLabelText('canDoHeading 1')[0]
    await user.clear(canDo)
    await user.type(canDo, 'Ich kann bis 20 zählen.')

    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalled())
    const sent = commitCurriculumImport.mock.calls[0][1].modules as DraftModule[]
    expect(sent[0].lessons[0].knowledgePoints[0].text).toBe('Zahlen 1-20')
    expect(sent[0].lessons[0].canDoStatements[0].text).toBe('Ich kann bis 20 zählen.')
  })

  it('omits a module the teacher unticked', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    await user.click(screen.getByLabelText('includeModule:{"title":"P01 – Plattform 1"}'))
    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalled())
    const sent = commitCurriculumImport.mock.calls[0][1].modules as DraftModule[]
    expect(sent).toHaveLength(1)
    expect(sent[0].clientId).toBe('K01')
  })

  it('omits a single session the teacher unticked but keeps its module', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    await user.click(screen.getByLabelText('includeLesson:{"title":"K01.2 – Grammatik"}'))
    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalled())
    const sent = commitCurriculumImport.mock.calls[0][1].modules as DraftModule[]
    expect(sent[0].lessons.map((l) => l.clientId)).toEqual(['K01.L1'])
  })

  it('sends the analysis job id so the server decides provenance, not the client', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)
    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalled())
    const body = commitCurriculumImport.mock.calls[0][1]
    expect(body.previewJobId).toBe('job-1')
    // Client không còn khai nguồn tài liệu nữa.
    expect(body).not.toHaveProperty('sourceMaterialId')
  })

  it('never commits before the teacher confirms', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    expect(commitCurriculumImport).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^importAll/ }))
    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalledTimes(1))
  })

  it('retrying after a failed commit reuses the same idempotency key', async () => {
    const user = userEvent.setup()
    commitCurriculumImport.mockRejectedValueOnce(new Error('network down'))
    renderWizard()
    await reachPreview(user)

    await user.click(screen.getByRole('button', { name: /^importAll/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')

    await user.click(screen.getByRole('button', { name: /^importAll/ }))
    await waitFor(() => expect(commitCurriculumImport).toHaveBeenCalledTimes(2))

    const first = commitCurriculumImport.mock.calls[0][1].idempotencyKey
    const second = commitCurriculumImport.mock.calls[1][1].idempotencyKey
    expect(second).toBe(first)
    expect(first).toBeTruthy()
  })

  it('shows a readable error when analysis fails and returns to the settings step', async () => {
    const user = userEvent.setup()
    waitForPreview.mockRejectedValue(new Error('Không phân tích được tài liệu.'))
    renderWizard()

    await screen.findByText('stepSource')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(await screen.findByRole('button', { name: 'analyze' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Không phân tích được tài liệu.')
    expect(screen.getByText('stepConfig')).toBeInTheDocument()
  })

  it('reports the imported counts to the page after a successful commit', async () => {
    const user = userEvent.setup()
    const onImported = vi.fn()
    renderWizard(onImported)
    await reachPreview(user)

    await user.click(screen.getByRole('button', { name: /^importAll/ }))

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({
        modulesCreated: 2,
        lessonsCreated: 3,
        firstModuleId: 11,
      }),
    )
  })

  it('keeps the confirm button reachable by keyboard and disabled while nothing is selected', async () => {
    const user = userEvent.setup()
    renderWizard()
    await reachPreview(user)

    // Untick every module: there is nothing left to import, so the confirm must be inert.
    await user.click(screen.getByLabelText('includeModule:{"title":"K01 – Erste Schritte"}'))
    await user.click(screen.getByLabelText('includeModule:{"title":"P01 – Plattform 1"}'))

    const confirm = screen.getByRole('button', { name: /^importAll/ })
    expect(confirm).toBeDisabled()

    confirm.focus()
    await user.keyboard('{Enter}')
    expect(commitCurriculumImport).not.toHaveBeenCalled()
  })

  it('rejects a non-PDF upload without calling the upload API', async () => {
    renderWizard()
    await screen.findByText('stepSource')

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // Fired directly rather than through user.upload: the input's `accept` attribute makes the
    // helper drop the file before any event reaches the component, which would test the browser
    // instead of the component's own guard — the line of defence that matters if `accept` is
    // bypassed (drag-and-drop, a scripted picker, a browser that ignores it).
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('errorNotPdf')
    expect(uploadMaterial).not.toHaveBeenCalled()
  })
})
