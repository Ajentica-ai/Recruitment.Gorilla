import type { EvaluationShare } from '@/types';

export type ShareStatus = 'active' | 'expired' | 'revoked';

/** A revoked share stays revoked even if it would also have expired. */
export function shareStatus(share: EvaluationShare): ShareStatus {
  if (share.revokedAt) return 'revoked';
  return share.isActive ? 'active' : 'expired';
}

/**
 * `PanelAutoShare` is written when booking the next round shares earlier rounds with its panel
 * (#187). The round it came from is not in the list payload yet, so the label stays generic.
 */
export function sourceLabel(source: string): string {
  return source === 'PanelAutoShare' ? 'Auto: panel' : 'Shared manually';
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function scopeLabel(share: EvaluationShare): string {
  return share.interviewId === null
    ? 'All rounds'
    : share.interviewScheduledAt
      ? `Interview on ${dateTime(share.interviewScheduledAt)}`
      : 'One interview';
}

export function expiryLabel(share: EvaluationShare): string {
  return share.expiresAt ? dateOnly(share.expiresAt) : 'No expiry';
}

export { dateTime as formatShareDateTime };

/** The expiry the date input holds (`YYYY-MM-DD`) as the end of that day, local time, as an ISO string. */
export function endOfDayIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

/** A server error as text: the share endpoints answer 400 with a plain string body. */
export function serverErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  const message = (data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
