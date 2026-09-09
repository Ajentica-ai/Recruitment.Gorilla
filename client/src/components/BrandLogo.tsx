/**
 * The Recruitment Gorilla logo: the badge artwork beside (or above) a
 * two-weight, letterspaced wordmark.
 *
 * Structure notes:
 *
 * 1. **The mark is a raster asset, the wordmark is HTML text.** Putting the
 *    wordmark in the image too would mean shipping a second file per layout
 *    and re-rendering it whenever the type tokens change. As HTML it is
 *    typeset by the same Figtree stack and tokens as the rest of the app, and
 *    it stays selectable and legible at every size.
 *
 * 2. **Three layouts, one source.** `stacked` (mark over wordmark) is the
 *    presentation lockup for the sign-in card; `horizontal` fits the sidebar's
 *    30px row; `mark` is the badge alone for the collapsed rail.
 *
 * The artwork is imported rather than referenced from /public so Vite fingerprints
 * it and rewrites the URL under the gateway's `/ats/` base — a hardcoded
 * "/brand-logo.png" would 404 in the container build. Its background was made
 * transparent when the asset was generated, so no theme-specific plate is
 * needed behind it; see the brand block in index.css.
 */
import markUrl from '../assets/brand-logo.png';

type Layout = 'stacked' | 'horizontal' | 'mark';

type Props = {
  layout?: Layout;
  /** Mark size in px. The wordmark scales from it. */
  size?: number;
  className?: string;
  /** Set when the logo is the accessible name; omit when a label sits beside it. */
  title?: string;
};

export default function BrandLogo({
  layout = 'horizontal',
  size = 30,
  className = '',
  title,
}: Props) {
  return (
    <span
      className={`brand brand--${layout} ${className}`.trim()}
      style={{ ['--brand-size' as string]: `${size}px` }}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <span className="brand__mark" aria-hidden="true">
        <img src={markUrl} alt="" />
      </span>
      {layout !== 'mark' && (
        <span className="brand__word" aria-hidden={title ? true : undefined}>
          <span className="brand__word-a">Recruitment</span>
          <span className="brand__word-b">Gorilla</span>
        </span>
      )}
    </span>
  );
}
