/**
 * Structured error contract shared by both backends, so callers (e.g. the
 * boarding outbox) can distinguish "will never succeed — stop retrying"
 * from transient network failures without matching message text.
 */
export class PermissionError extends Error {
  constructor(message = 'Your role does not have permission to do that (blocked by access policy).') {
    super(message);
    this.name = 'PermissionError';
  }
}

/** PostgREST/RLS failure codes that mean the write is permanently rejected. */
export function isPermanentDbError(code: string | null | undefined): boolean {
  if (!code) return false;
  return (
    code === '42501' || // insufficient_privilege (RLS policy violation)
    code === '23503' || // foreign_key_violation
    code === '23514' || // check_violation
    code === 'PGRST116' // .single() matched 0 rows (RLS filtered it away)
  );
}
