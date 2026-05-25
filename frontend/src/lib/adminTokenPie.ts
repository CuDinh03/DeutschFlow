export type AiUsageByFeatureRow = {
  feature?: string
  totalTokens?: number
  promptTokens?: number
  completionTokens?: number
}

export type AiUsageByFeatureDto = {
  rows?: AiUsageByFeatureRow[]
  totalTokens?: number
  promptTokens?: number
  completionTokens?: number
  days?: number
}

export type AdminTokenPieSlice = {
  name: string
  value: number
  color: string
}

export type AdminTokenPie = {
  source: 'ledger' | 'estimate'
  slices: AdminTokenPieSlice[]
}

export function buildAiTokenPie(
  ledger: AiUsageByFeatureDto | null,
  fallbackTotal: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): AdminTokenPie {
  const rows = ledger?.rows ?? []
  const prompt = ledger?.promptTokens ?? rows.reduce((sum, row) => sum + (Number(row.promptTokens) || 0), 0)
  const completion = ledger?.completionTokens ?? rows.reduce((sum, row) => sum + (Number(row.completionTokens) || 0), 0)
  const total = ledger?.totalTokens ?? (fallbackTotal + prompt + completion)

  return {
    source: ledger ? 'ledger' : 'estimate',
    slices: [
      { name: t('piePrompt'), value: prompt, color: '#0F172A' },
      { name: t('pieCompletion'), value: completion, color: '#0C4A7C' },
      { name: t('pieOther'), value: Math.max(0, total - prompt - completion), color: '#F59E0B' },
    ],
  }
}
