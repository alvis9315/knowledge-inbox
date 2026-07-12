import { isMock } from '@/services/dataMode'
import { mockDb } from '@/services/mock/mockDb'

export interface Classification {
  type: string | null
  confidence: number
}

/**
 * Guess a category for freeform text. Mock mode uses a keyword heuristic;
 * Phase 2 will swap this for the Claude Haiku call in the /ingest Edge Function —
 * same return shape, so callers don't change.
 */
export async function classifyText(text: string): Promise<Classification> {
  if (isMock()) return mockDb.classify(text)
  // Phase 2: POST to /ingest for real classification. Until then, no auto-file.
  return { type: null, confidence: 0 }
}
