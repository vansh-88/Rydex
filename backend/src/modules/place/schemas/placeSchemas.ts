import { z } from 'zod';

const MAX_SUGGESTIONS = 10;

// A 2-character floor because a single letter matches most of the country
// and spends a provider call to say nothing useful. The max length is a
// guard against someone pasting a novel into the query string, not a real
// product limit.
export const autocompleteQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().positive().max(MAX_SUGGESTIONS).optional(),
});
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
