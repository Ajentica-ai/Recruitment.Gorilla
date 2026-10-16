import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Prev/next pager with a result count and page size selector.
 *
 * The page size is a Radix Select, not a native <select>: the pager sits at the
 * bottom of the page, and a native option list is drawn by the browser, so it
 * can hang past the window edge. Radix draws the list in the page and keeps it
 * inside the viewport (it opens upward when there is no room below).
 */
export default function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  noun,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /** Singular; pluralised for the count, e.g. "candidate" → "12 candidates". */
  noun: string;
  /** Options for rows/items per page dropdown, e.g. [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Callback when user changes page size. */
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[length:var(--text-sm)] whitespace-nowrap text-muted-foreground">
          {totalCount.toLocaleString()} {noun}
          {totalCount === 1 ? '' : 's'}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-[length:var(--text-sm)] text-muted-foreground">
            <span className="hidden sm:inline">Show</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger size="sm" className="h-8 w-20 py-0.5 text-xs" aria-label={`${noun}s per page`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((sz) => (
                  <SelectItem key={sz} value={String(sz)}>
                    {sz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden sm:inline">per page</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="px-1 text-[length:var(--text-sm)] whitespace-nowrap text-muted-foreground tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
