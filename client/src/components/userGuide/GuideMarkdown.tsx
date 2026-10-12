import { isValidElement, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { slugify } from '@/utils/slugify';

const IMAGE_BASE = '/user-guide/images/';

/** Plain text of a rendered heading/link, so its id can be slugified the same way headingsOf() does. */
function textContent(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent((node.props as { children?: ReactNode }).children);
  return '';
}

function scrollToAnchor(id: string) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ block: 'start' });
    history.replaceState(null, '', `#${id}`);
  }
}

function heading(level: 1 | 2 | 3) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  const sizeClass =
    level === 1
      ? 'mt-10 text-[length:var(--text-2xl)] first:mt-0'
      : level === 2
        ? 'mt-8 text-[length:var(--text-xl)]'
        : 'mt-6 text-[length:var(--text-lg)]';
  function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(textContent(children));
    return (
      <Tag
        id={id}
        className={cn('font-bold leading-[var(--leading-tight)] tracking-[var(--tracking-display)] scroll-mt-20', sizeClass)}
      >
        {children}
      </Tag>
    );
  }
  return Heading;
}

/**
 * Renders one chapter's Markdown using the app's own typography and tokens,
 * rather than an embedded document — see the "native page" decision in the
 * user guide spec.
 *
 * `knownAnchors` is every heading id across the *reader's whole guide* (every
 * chapter they have, not just this one): a cross-reference such as
 * `[2.2](#22-your-dashboard)` in Chapter 0 only resolves for a Recruiter and
 * above, so an Interviewer sees that same link rendered as plain text instead
 * of a dead jump.
 */
export default function GuideMarkdown({
  markdown,
  knownAnchors,
}: {
  markdown: string;
  knownAnchors: ReadonlySet<string>;
}) {
  const components: Components = {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    p: ({ children }) => (
      <p className="my-3 leading-[var(--leading-normal)] text-foreground">{children}</p>
    ),
    ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
    li: ({ children }) => <li className="leading-[var(--leading-normal)]">{children}</li>,
    hr: () => <hr className="my-8 border-border" />,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 rounded-[var(--radius-lg)] border-l-4 border-brand bg-brand-muted px-4 py-2 text-foreground">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded-[var(--radius-sm)] border border-border bg-muted px-1 py-0.5 text-[length:var(--text-sm)]">
        {children}
      </code>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full border-collapse text-[length:var(--text-sm)]">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-border bg-muted px-3 py-2 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top">{children}</td>,
    img: ({ src, alt }) => {
      const resolved = typeof src === 'string' && src.startsWith('images/') ? `${IMAGE_BASE}${src.slice('images/'.length)}` : src;
      return (
        <figure className="my-4">
          <img
            src={resolved}
            alt={alt ?? ''}
            loading="lazy"
            className="max-w-full rounded-[var(--radius-lg)] border border-border"
          />
          {alt && (
            <figcaption className="mt-1.5 text-[length:var(--text-xs)] text-muted-foreground">{alt}</figcaption>
          )}
        </figure>
      );
    },
    a: ({ href, children }) => {
      if (href?.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (!knownAnchors.has(id)) {
          // The target chapter is not in this reader's edition — no dead jump.
          return <span>{children}</span>;
        }
        return (
          <a
            href={`#${id}`}
            className="text-brand underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              scrollToAnchor(id);
            }}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="guide-article max-w-none">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
