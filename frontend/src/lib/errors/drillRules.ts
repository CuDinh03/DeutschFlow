import type { DrillScoringRule } from '@/lib/scoring/textScoring'

export interface DrillRule {
  rewriteTarget_de: string
  scoring: DrillScoringRule
}

/** Detailed anchoring for frequent codes; others use fuzzy-only in drill */
export const DRILL_RULES: Partial<Record<string, DrillRule>> = {
  'WORD_ORDER.V2_MAIN_CLAUSE': {
    rewriteTarget_de: 'Heute gehe ich zur Arbeit.',
    scoring: {
      anchors_required: ['heute', 'gehe', 'ich'],
      order_constraints: [
        { before: 'heute', after: 'gehe' },
        { before: 'gehe', after: 'ich' },
      ],
      levenshtein_max_ratio: 0.3,
    },
  },
  'WORD_ORDER.SUBCLAUSE_VERB_FINAL': {
    rewriteTarget_de: 'Weil ich müde bin, gehe ich nach Hause.',
    scoring: {
      anchors_required: ['weil', 'müde', 'bin'],
      levenshtein_max_ratio: 0.35,
    },
  },
  'WORD_ORDER.NICHT_POSITION': {
    rewriteTarget_de: 'Ich verstehe nicht.',
    scoring: {
      anchors_required: ['ich', 'verstehe', 'nicht'],
      order_constraints: [{ before: 'verstehe', after: 'nicht' }],
      levenshtein_max_ratio: 0.25,
    },
  },
  'CASE.PREP_DAT_MIT': {
    rewriteTarget_de: 'Ich gehe mit meinem Freund.',
    scoring: {
      anchors_required: ['mit', 'meinem'],
      levenshtein_max_ratio: 0.35,
    },
  },
  'CASE.PREP_AKK_FUER': {
    rewriteTarget_de: 'Das ist für meinen Bruder.',
    scoring: {
      anchors_required: ['für', 'meinen'],
      levenshtein_max_ratio: 0.35,
    },
  },
  'VERB.CONJ_PERSON_ENDING': {
    rewriteTarget_de: 'Er geht nach Hause.',
    scoring: {
      anchors_required: ['er', 'geht'],
      levenshtein_max_ratio: 0.3,
    },
  },
  'VERB.SEIN_HABEN_PRESENT': {
    rewriteTarget_de: 'Ich habe Hunger.',
    scoring: {
      anchors_required: ['ich', 'habe', 'hunger'],
      levenshtein_max_ratio: 0.3,
    },
  },
  'ARTICLE.GENDER_WRONG_DER_DIE_DAS': {
    rewriteTarget_de: 'der Tisch',
    scoring: {
      anchors_required: ['der', 'tisch'],
      levenshtein_max_ratio: 0.35,
    },
  },
}

export function getDrillRule(code: string): DrillRule | null {
  return DRILL_RULES[code] ?? null
}
