import type { ActivityItem } from '../../types';

export const relativeTime = (iso: string, now = Date.now()): string => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const dayLabel = (iso: string, now: Date): string => {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start - day) / (24 * 3600 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Consecutive changes to one candidate on one day, newest first. */
export interface ActivityRun {
  key: string;
  candidateId: number;
  fullName: string;
  changedBy: string;
  /** Newest first, as the API returns them. */
  events: ActivityItem[];
}

export interface ActivityDay {
  label: string;
  runs: ActivityRun[];
}

/**
 * Groups the feed by day, and folds back-to-back changes to the same candidate
 * into one run, so ten "Offer Extended / Offer Accepted" lines for one person
 * become a single row that expands on demand.
 */
export function groupActivity(items: ActivityItem[], now = new Date()): ActivityDay[] {
  const days: ActivityDay[] = [];
  items.forEach((item, i) => {
    const label = dayLabel(item.changedAt, now);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    if (run && run.candidateId === item.candidateId) run.events.push(item);
    else
      day.runs.push({
        key: `${item.candidateId}-${i}`,
        candidateId: item.candidateId,
        fullName: item.fullName,
        changedBy: item.changedBy,
        events: [item],
      });
  });
  return days;
}
