import type { TokenSlice } from '@/lib/adminDashboardMock'
import { buildTokenServicePie } from '@/lib/adminDashboardMock'

export type AiUsageByFeatureDto = {
  days: number
  fromUtc: string
  toUtc: string
  totalTokens: number
  byFeature: Array<{ feature: string; totalTokens: number }>
}

const PIE_PALETTE = [
  '#2D9CDB',
  '#9B51E0',
  '#F2994A',
  '#27AE60',
  '#EB5757',
  '#56CCF2',
  '#BB6BD9',
  '#F2C94C',
  '#219653',
  '#6FCF97',
]

function featureLabel(code: string, t: (k: string) => string): string {
  switch (code) {
    case 'SPEAKING_CHAT':
      return t('pieFeatSpeakingChat')
    case 'SPEAKING_STREAM':
      return t('pieFeatSpeakingStream')
    case 'SPEAKING_TRANSCRIBE':
      return t('pieFeatSpeakingTranscribe')
    case 'WEEK_RUBRIC':
      return t('pieFeatWeekRubric')
    case 'VOCAB_AUTO_TAG':
      return t('pieFeatVocabAutoTag')
    case 'UNKNOWN':
      return t('pieFeatUnknown')
    default:
      return code
  }
}

/** Prefer ledger breakdown; fall back to illustrative mix like the legacy mock. */
export function buildAiTokenPie(
  ledger: AiUsageByFeatureDto | null,
  sumUsedMonthlyQuota: number,
  t: (k: string) => string,
): { slices: TokenSlice[]; source: 'ledger' | 'estimate' } {
  const rows = ledger?.byFeature?.filter((x) => Number(x.totalTokens) > 0) ?? []
  const sum = rows.reduce((s, x) => s + (Number(x.totalTokens) || 0), 0)
  if (sum <= 0) {
    return {
      slices: buildTokenServicePie(sumUsedMonthlyQuota, {
        speaking: t('sliceSpeaking'),
        llm: t('sliceLlm'),
        grammar: t('sliceGrammar'),
        other: t('sliceOther'),
      }),
      source: 'estimate',
    }
  }

  let display = [...rows]
  const max = PIE_PALETTE.length
  if (display.length > max) {
    const head = display.slice(0, max - 1)
    const tail = display.slice(max - 1)
    const grouped = tail.reduce((s, x) => s + (Number(x.totalTokens) || 0), 0)
    display = [...head, { feature: '__OTHER_COMBINED__', totalTokens: grouped }]
  }

  const slices: TokenSlice[] = display.map((r, idx) => {
    const name =
      r.feature === '__OTHER_COMBINED__'
        ? t('pieFeatureGroupedOther')
        : featureLabel(r.feature, t)
    return {
      name,
      value: Number(r.totalTokens) || 0,
      color: PIE_PALETTE[idx % PIE_PALETTE.length],
    }
  })

  return { slices, source: 'ledger' }
}
