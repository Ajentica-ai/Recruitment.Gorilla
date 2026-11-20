import { Fragment } from 'react';

// A line that starts with a bullet glyph (a space after it is optional, since PDF text often has none) or a
// "-", "*" or en dash followed by a space. "-5% churn" and "Co-founded" are plain text, not bullets.
const BULLET = /^\s*(?:[•●▪‣◦·]\s*|[-*–]\s+)(.+)$/;

type Block = { kind: 'text'; text: string } | { kind: 'list'; items: string[] };

function toBlocks(description: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = BULLET.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      const item = bullet[1].trim();
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'text', text: line });
    }
  }
  return blocks;
}

/**
 * A work-experience description from a CV or the edit form: bullet lines become a real list, other lines
 * stay as their own paragraphs (#262). Nothing is rendered for a blank description.
 */
export default function ExperienceDescription({ text }: { text?: string | null }) {
  const blocks = text ? toBlocks(text) : [];
  if (blocks.length === 0) return null;
  return (
    <div className="experience-card__desc">
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {b.kind === 'text' ? (
            <p>{b.text}</p>
          ) : (
            <ul>
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}
