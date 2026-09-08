import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

/**
 * Prev/next pager with a result count and page size selector.
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
            <NativeSelect
              size="sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 py-0.5 text-xs w-20"
              aria-label={`${noun}s per page`}
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </NativeSelect>
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
