/** Adaptive repair gate (AI Speaking chat). */
export type RepairGateState = {
  code: string;
  exampleCorrectDe?: string;
  ruleViShort?: string;
  blocking?: boolean;
} | null;
