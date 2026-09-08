// Maps a candidate status to a "tone" (a CSS design-token class). Colors live in
// index.css as CSS variables so they adapt to a future dark theme (data-bs-theme).
// Consumed by the shared StatusBadge / StatusDot components.

export type StatusTone =
  | 'reject'
  | 'success'
  | 'interview'
  | 'assessment'
  | 'muted'
  | 'uploaded'
  | 'intake';

const STATUS_TONE: Record<string, StatusTone> = {
  Reject: 'reject',
  'Not Recommended': 'reject',
  Discontinued: 'reject',
  Recommended: 'success',
  'Call for Interview': 'interview',
  'Interview Scheduled': 'interview',
  'Interview Completed': 'interview',
  'Technical Assessment': 'assessment',
  'Submission Received': 'assessment',
  'Submission Receieved': 'assessment',
  'Code Review': 'assessment',
  'No Submission': 'muted',
  'Not Available': 'muted',
  Uploaded: 'uploaded',
  'Ask for Assesment': 'intake',
  'Ask for Assessment': 'intake',
  'Offer Preparation': 'assessment',
  'Offer Extended': 'interview',
  'Offer Accepted': 'success',
  'Offer Declined': 'reject',
  Hired: 'success',
};

/** Solid hexes mirroring the `.status--*` tokens in index.css. Kept in sync by
 *  hand because charts and the dropdown swatches need a literal value, not a
 *  CSS variable. Mid-tones: legible on both the light and the dark surface. */
export const STATUS_HEX_COLORS: Record<StatusTone, string> = {
  uploaded: '#64748b',
  intake: '#d97706',
  assessment: '#7c3aed',
  interview: '#2563eb',
  success: '#059669',
  reject: '#dc2626',
  muted: '#94a3b8',
};

/** Solid hex color corresponding to the status tone. */
export const getStatusSolidColor = (status: string): string => {
  const tone = getStatusTone(status);
  return STATUS_HEX_COLORS[tone] || '#64748b';
};

/** Tone key for a status (defaults to muted for unknown values). */
export const getStatusTone = (status: string): StatusTone => STATUS_TONE[status] ?? 'muted';

/** CSS modifier class carrying the status color tokens, e.g. "status--reject". */
export const getStatusClass = (status: string): string => `status--${getStatusTone(status)}`;
