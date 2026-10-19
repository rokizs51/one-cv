import { z } from 'zod';
import type { ItemType } from '@/lib/domain/types';
import { JdRequirementSchema } from '@/lib/domain/schemas';

/**
 * Explicit match states — never a single opaque score.
 * supported: profile evidence adequately establishes the requirement.
 * partial: evidence exists but doesn't fully establish it.
 * needs_review: evidence exists but is ambiguous / needs user confirmation.
 * not_established: no supporting evidence found IN THE PROFILE — this says
 *   nothing about the user's actual capabilities, only about recorded ones.
 * not_applicable: cannot meaningfully be assessed against a profile.
 */
export const MATCH_STATUSES = ['supported', 'partial', 'needs_review', 'not_established', 'not_applicable'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// Confidence rates the ASSESSMENT, not the user. Kept separate from status.
export const MATCH_CONFIDENCES = ['low', 'medium', 'high'] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCES)[number];

const ITEM_TYPE_VALUES = [
  'career_snapshot',
  'education',
  'experience',
  'project',
  'award',
  'skill',
  'language',
] as const satisfies readonly ItemType[];

export const MatchEvidenceSchema = z.object({
  itemId: z.string(),
  sourceType: z.enum(ITEM_TYPE_VALUES),
}).strict();
export type MatchEvidence = z.infer<typeof MatchEvidenceSchema>;

/** What the model returns: one assessment per requirement it was given. */
export const MatchModelMatchSchema = z.object({
  requirementId: z.string(),
  status: z.enum(MATCH_STATUSES),
  confidence: z.enum(MATCH_CONFIDENCES),
  evidenceRefs: z.array(MatchEvidenceSchema).default([]),
  explanation: z.string().min(1),
  followUpQuestion: z.string().optional(),
  recommendation: z.string().optional(),
}).strict();

export const MatchModelOutputSchema = z.object({
  matches: z.array(MatchModelMatchSchema),
}).strict();
export type MatchAnalysisModelOutput = z.infer<typeof MatchModelOutputSchema>;

/** A stored, post-validated match. `userConfirmation` is recorded only by the
 * explicit confirmation workflow (PATCH), never by the model. */
export const MatchEntrySchema = z.object({
  requirementId: z.string(),
  status: z.enum(MATCH_STATUSES),
  confidence: z.enum(MATCH_CONFIDENCES),
  evidenceRefs: z.array(MatchEvidenceSchema),
  explanation: z.string(),
  followUpQuestion: z.string().optional(),
  recommendation: z.string().optional(),
  userConfirmation: z
    .object({
      status: z.enum(MATCH_STATUSES),
      note: z.string().default(''),
      at: z.string(),
    })
    .optional(),
}).strict();
export type MatchEntry = z.infer<typeof MatchEntrySchema>;

export const MatchSummarySchema = z.object({
  totals: z.object({
    requirements: z.number(),
    supported: z.number(),
    partial: z.number(),
    needs_review: z.number(),
    not_established: z.number(),
    not_applicable: z.number(),
  }),
  byImportance: z.object({
    mandatory: z.record(z.string(), z.number()),
    preferred: z.record(z.string(), z.number()),
  }),
  strongest: z.array(z.string()),
  gaps: z.array(z.string()),
  questions: z.array(z.string()),
  adjustments: z.array(z.string()),
}).strict();
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

export const MatchAnalysisResultSchema = z.object({
  // Same shape as an extraction requirement, but the id is REQUIRED: by the
  // time an analysis stores them, finalizeRequirements has assigned them.
  requirements: z.array(JdRequirementSchema.extend({ id: z.string() })),
  matches: z.array(MatchEntrySchema),
  summary: MatchSummarySchema,
}).strict();
export type MatchAnalysisResult = z.infer<typeof MatchAnalysisResultSchema>;
export type RequirementRecord = MatchAnalysisResult['requirements'][number];

/** What genAI.analyzeMatch receives / returns (interface seam). */
export interface MatchAnalysisRequest {
  requirements: RequirementRecord[];
  items: { itemId: string; type: ItemType; text: string }[];
}
