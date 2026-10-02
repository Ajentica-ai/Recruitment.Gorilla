/**
 * Turns a stored profile/submission link into a safe absolute href.
 *
 * CV extraction and hand entry often store links without a scheme
 * ("linkedin.com/in/jane"), which the browser resolves relative to the current
 * page ("/candidates/linkedin.com/in/jane"). Bare links get "https://"; links
 * that already use http(s) pass through. Any other scheme (javascript:,
 * data:, ...) returns undefined so it is never rendered as a link.
 */
export function externalUrl(raw: string | null | undefined): string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  // "scheme:" that is not a "host:port" (digits after the colon).
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return undefined;
  return `https://${value}`;
}
