/**
 * Interview times that have already passed (#263). A Recruiter or Super Admin may book or move to one, with a
 * reason; nothing is sent to anyone for it. The server enforces all of this; these are the messages and the check
 * the forms use so the user hears it before submitting.
 */
export const PAST_TIME_NOTE = 'This time is in the past. Invites will not be sent.';
export const FUTURE_ONLY_ERROR = 'Pick a time in the future.';
export const PAST_REASON_ERROR = 'A reason is required when the time is in the past.';

/** True when a datetime-local style value is at or before now. An empty value is not past. */
export const isPastTime = (value: string): boolean => !!value && new Date(value).getTime() <= Date.now();
