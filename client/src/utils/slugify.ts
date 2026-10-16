export interface GuideHeading {
  level: 1 | 2;
  text: string;
  id: string;
}

/**
 * GitHub-compatible heading slug: lowercase, drop anything that isn't a
 * letter, digit, space or hyphen, then turn spaces into hyphens.
 *
 * This has to match GitHub's algorithm exactly, not just produce "a" slug:
 * the guide's own cross-reference links (`[2.2](#22-your-dashboard)`) were
 * written against it, and this function is what turns those same headings
 * into the ids the links need to resolve to.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

/** The `#`/`##` headings in a chapter's Markdown, in document order, each with its slug id. */
export function headingsOf(markdown: string): GuideHeading[] {
  const headings: GuideHeading[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,2}) (.+)$/.exec(line.trimStart());
    if (!match) continue;
    const text = match[2].replace(/\*\*/g, '').trim();
    headings.push({ level: match[1].length as 1 | 2, text, id: slugify(text) });
  }
  return headings;
}
