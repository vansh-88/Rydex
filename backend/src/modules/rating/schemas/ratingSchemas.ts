import { z } from 'zod';

// claude.md §53: score bounds are enforced here rather than by a DB CHECK
// constraint, matching the precedent set on Payment's ride/booking
// exclusivity — Prisma doesn't model arbitrary CHECK constraints
// declaratively, and this is a plain input-range check that validation is
// already the right layer for.
export const RATING_MIN_SCORE = 1;
export const RATING_MAX_SCORE = 5;

const COMMENT_MAX_LENGTH = 1000;

// Deliberately no `rateeId`/`rateeRole`/`raterId` field: who is being rated is
// derived server-side from the booking and the authenticated caller
// (ratingService.resolveDirection), never stated by the client. Same reasoning
// as every other module — identity comes from req.user.id (claude.md §54/§68).
export const submitRatingSchema = z.object({
  score: z.coerce.number().int().min(RATING_MIN_SCORE).max(RATING_MAX_SCORE),
  comment: z.string().trim().min(1).max(COMMENT_MAX_LENGTH).optional(),
});
export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
