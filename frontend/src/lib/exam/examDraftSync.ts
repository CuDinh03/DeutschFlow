/**
 * Debounced server-autosave engine for the mock-exam runner (V285, audit C-02).
 *
 * Pure orchestration — the caller injects the transport (`save`). Answers are the server's
 * source of truth while an exam runs: every change debounce-saves with an optimistic
 * `baseVersion`; a continuously-typing user still saves at least every `maxIntervalMs`.
 * Conflicts (another device saved a newer draft) and expiry (server deadline passed) are
 * reported to the owner — the autosaver never auto-resolves them.
 */

export interface DraftPayload {
  answers: Record<string, string>
  sectionIndex: number
}

export interface ServerDraft {
  answersJson: string | null
  sectionIndex: number | null
  questionIndex: number | null
  version: number
}

export type DraftSaveResult =
  | { kind: 'saved'; version: number; remainingSeconds: number | null }
  | { kind: 'conflict'; serverVersion: number; draft: ServerDraft | null }
  | { kind: 'expired' }
  | { kind: 'error' }

export interface DraftAutosaverOptions {
  save: (payload: DraftPayload, baseVersion: number) => Promise<DraftSaveResult>
  onSaved?: (result: { version: number; remainingSeconds: number | null }) => void
  onConflict?: (result: { serverVersion: number; draft: ServerDraft | null }) => void
  onExpired?: () => void
  /** Quiet delay after the last change before saving. */
  debounceMs?: number
  /** Ceiling between two saves while changes keep coming. */
  maxIntervalMs?: number
  /** Retry delay after a transport error (draft stays dirty). */
  retryMs?: number
}

export interface DraftAutosaver {
  /** Report the latest client state; schedules a debounced save. */
  notifyChange(payload: DraftPayload): void
  /** Immediately save if dirty (awaitable — used before controlled exits). */
  flush(): Promise<void>
  /** Dirty state for a fire-and-forget keepalive flush (pagehide), or null when clean. */
  getSnapshot(): { payload: DraftPayload; baseVersion: number } | null
  /** Adopt a version the owner learned out-of-band (conflict reconcile, resume). */
  adoptVersion(version: number): void
  getBaseVersion(): number
  dispose(): void
}

export const DRAFT_DEBOUNCE_MS = 2_500
export const DRAFT_MAX_INTERVAL_MS = 10_000
export const DRAFT_RETRY_MS = 10_000

export function createDraftAutosaver(opts: DraftAutosaverOptions): DraftAutosaver {
  const debounceMs = opts.debounceMs ?? DRAFT_DEBOUNCE_MS
  const maxIntervalMs = opts.maxIntervalMs ?? DRAFT_MAX_INTERVAL_MS
  const retryMs = opts.retryMs ?? DRAFT_RETRY_MS

  let latest: DraftPayload | null = null
  let baseVersion = 0
  let dirty = false
  let inFlight = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  // Counted from creation so the very first change debounces instead of saving instantly
  // (the max-interval cap otherwise reads "last save infinitely long ago").
  let lastSaveAt = Date.now()

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (delay: number) => {
    if (disposed) return
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void doSave()
    }, delay)
  }

  const doSave = async (): Promise<void> => {
    if (disposed || inFlight || !dirty || latest === null) return
    const payload = latest
    const version = baseVersion
    inFlight = true
    dirty = false
    try {
      const result = await opts.save(payload, version)
      if (disposed) return
      switch (result.kind) {
        case 'saved':
          baseVersion = result.version
          lastSaveAt = Date.now()
          opts.onSaved?.({ version: result.version, remainingSeconds: result.remainingSeconds })
          break
        case 'conflict':
          // Owner decides (usually: adopt the server draft + adoptVersion). No auto-retry —
          // resaving the same stale payload would just conflict again.
          opts.onConflict?.({ serverVersion: result.serverVersion, draft: result.draft })
          break
        case 'expired':
          opts.onExpired?.()
          dispose()
          return
        case 'error':
          dirty = true
          schedule(retryMs)
          return
      }
    } catch {
      if (disposed) return
      dirty = true
      schedule(retryMs)
      return
    } finally {
      inFlight = false
    }
    // Changes that arrived while the request was in flight need one more save.
    if (dirty) schedule(debounceMs)
  }

  const dispose = () => {
    disposed = true
    clearTimer()
  }

  return {
    notifyChange(payload: DraftPayload) {
      if (disposed) return
      latest = payload
      dirty = true
      const sinceLastSave = Date.now() - lastSaveAt
      const capDelay = Math.max(0, maxIntervalMs - sinceLastSave)
      schedule(Math.min(debounceMs, capDelay))
    },
    async flush() {
      clearTimer()
      await doSave()
    },
    getSnapshot() {
      if (!dirty || latest === null) return null
      return { payload: latest, baseVersion }
    },
    adoptVersion(version: number) {
      baseVersion = version
    },
    getBaseVersion() {
      return baseVersion
    },
    dispose,
  }
}

/**
 * Maps a failed PATCH …/draft HTTP response to a DraftSaveResult. Kept pure for tests;
 * the page's axios error handler feeds (status, body) in.
 */
export function classifyDraftSaveError(status: number, data: unknown): DraftSaveResult {
  if (status === 410) return { kind: 'expired' }
  if (status === 409) {
    const body = (data ?? {}) as Record<string, unknown>
    const rawDraft = body.draft as Record<string, unknown> | undefined
    const serverVersion =
      typeof body.server_version === 'number' ? body.server_version : Number(body.server_version ?? 0)
    const draft: ServerDraft | null = rawDraft
      ? {
          answersJson: typeof rawDraft.answers_json === 'string' ? rawDraft.answers_json : null,
          sectionIndex: typeof rawDraft.section_index === 'number' ? rawDraft.section_index : null,
          questionIndex: typeof rawDraft.question_index === 'number' ? rawDraft.question_index : null,
          version: typeof rawDraft.version === 'number' ? rawDraft.version : serverVersion,
        }
      : null
    return { kind: 'conflict', serverVersion: Number.isFinite(serverVersion) ? serverVersion : 0, draft }
  }
  return { kind: 'error' }
}

/**
 * Server-driven countdown resync: trust the local ticking clock for small drift (UI
 * smoothness) but snap to the server's remaining seconds when they disagree materially.
 */
export function resyncCountdown(localSeconds: number, serverSeconds: number, toleranceSeconds = 5): number {
  if (!Number.isFinite(serverSeconds) || serverSeconds < 0) return localSeconds
  return Math.abs(localSeconds - serverSeconds) > toleranceSeconds ? serverSeconds : localSeconds
}

/** Parses a draft answers_json string into the runner's answer map (defensive on shape). */
export function parseDraftAnswers(answersJson: string | null | undefined): Record<string, string> {
  if (!answersJson) return {}
  try {
    const parsed: unknown = JSON.parse(answersJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}
