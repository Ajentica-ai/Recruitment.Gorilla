import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { StatusOption } from '@/types';

export interface KanbanMinimapProps {
  statusOptions: StatusOption[];
  boardRef: React.RefObject<HTMLDivElement | null>;
}

/** One column, as a fraction of the board's total scrollable width. */
type Block = { id: string | number; left: number; width: number; filled: boolean };

/**
 * A minimap of the board, on Jira's model.
 *
 * It is a MINIATURE, not a scrollbar: each column is drawn at its real
 * proportional width, columns holding candidates are tinted, and a lens marks
 * the slice currently on screen. That is what makes it useful across nineteen
 * stages — you can see that the work sits in the first three columns and drag
 * straight to the far end.
 *
 * Two earlier versions were wrong in opposite directions. The first drew one
 * identical bar per stage regardless of the column beneath it, so with
 * nineteen stages it read as a barcode and the picture was not the board. The
 * second replaced it with a plain scrollbar track, which was honest but threw
 * away the only thing a minimap is for.
 *
 * Geometry is measured from the real columns on scroll and resize rather than
 * assumed, so a column that grows with its card count is reflected.
 */
export default function KanbanMinimap({ statusOptions, boardRef }: KanbanMinimapProps) {
  const [lens, setLens] = useState({ left: 0, width: 1 });
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isScrollable, setIsScrollable] = useState(false);
  const isDraggingRef = useRef(false);
  const minimapRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setIsScrollable(scrollWidth > clientWidth + 10);
    if (scrollWidth <= 0) return;

    setLens({
      left: scrollLeft / scrollWidth,
      width: Math.min(1, clientWidth / scrollWidth),
    });

    const columns = Array.from(el.querySelectorAll<HTMLElement>('.kanban-column'));
    setBlocks(
      columns.map((col, i) => ({
        id: statusOptions[i]?.id ?? i,
        left: col.offsetLeft / scrollWidth,
        width: col.offsetWidth / scrollWidth,
        // A column with cards in it is worth seeing from here; an empty stage
        // is context, not a destination.
        filled: col.querySelectorAll('.kanban-card').length > 0,
      })),
    );
  }, [boardRef, statusOptions]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // The columns are measured after the cards land, so re-measure when the
    // board's own size changes rather than guessing with a timeout.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const timer = setTimeout(measure, 120);

    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [boardRef, measure]);

  /** Centre the board on the point clicked, in minimap coordinates. */
  const scrollToPosition = (clientX: number) => {
    const minimapEl = minimapRef.current;
    const boardEl = boardRef.current;
    if (!minimapEl || !boardEl) return;

    const rect = minimapEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width;
    boardEl.scrollTo({
      left: Math.max(0, ratio * boardEl.scrollWidth - boardEl.clientWidth / 2),
      behavior: isDraggingRef.current ? 'auto' : 'smooth',
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    scrollToPosition(e.clientX);

    const onMove = (ev: MouseEvent) => {
      if (isDraggingRef.current) scrollToPosition(ev.clientX);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /** Arrow keys nudge by one viewport, so the control is not pointer-only. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const step = boardEl.clientWidth * 0.6;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      boardEl.scrollBy({ left: step, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      boardEl.scrollBy({ left: -step, behavior: 'smooth' });
    }
  };

  if (!isScrollable || statusOptions.length <= 1) return null;

  return (
    <div
      className="kanban-minimap"
      ref={minimapRef}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      title="Drag to move across the board"
      aria-label="Board overview — drag to scroll"
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(lens.left * 100)}
    >
      <div className="kanban-minimap__stage">
        {blocks.map((b) => (
          <span
            key={b.id}
            className={`kanban-minimap__col${b.filled ? ' kanban-minimap__col--filled' : ''}`}
            style={{ left: `${b.left * 100}%`, width: `${b.width * 100}%` }}
          />
        ))}
        <div
          className="kanban-minimap__lens"
          style={{ left: `${lens.left * 100}%`, width: `${lens.width * 100}%` }}
        />
      </div>
    </div>
  );
}
