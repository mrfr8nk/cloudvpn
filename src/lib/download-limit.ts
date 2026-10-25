// Pure parsing of the per-link limits sent with an upload, kept out of the server
// route so the rules can be tested without loading backend clients.

const MAX_DOWNLOADS_CAP = 100000;
const EXPIRY_CAP_MINUTES = 43200; // 30 days

/**
 * How many downloads a link allows before it dies.
 * Burn after 1 is the default when the caller sends no value at all.
 * An explicit "0" (or anything below 1) means unlimited.
 */
export function parseMaxDownloads(field: FormDataEntryValue | null): number | null {
  const raw = field === null ? 1 : Number(field);
  if (!Number.isFinite(raw) || raw < 1) return null;
  return Math.min(Math.floor(raw), MAX_DOWNLOADS_CAP);
}

/** Minutes until a link expires. Defaults to 30 minutes, capped at 30 days. */
export function parseExpiresMinutes(field: FormDataEntryValue | null): number {
  const raw = field === null ? 30 : Number(field);
  if (!Number.isFinite(raw) || raw < 1) return 30;
  return Math.min(Math.floor(raw), EXPIRY_CAP_MINUTES);
}
