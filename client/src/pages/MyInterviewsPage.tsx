import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import LoadingPanel from '@/components/common/Loading';
import Page from '@/components/common/Page';
import Pagination from '@/components/common/Pagination';
import Tabs, { TabPanel, type TabDef } from '@/components/common/Tabs';
import { useTabs } from '@/components/common/useTabs';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { getMyInterviewHistory } from '@/services/api';
import type { MyInterviewHistoryRow, MyInterviewTab } from '@/types';

const TAB_IDS: MyInterviewTab[] = ['upcoming', 'awaiting', 'submitted', 'cancelled'];

const TAB_LABELS: Record<MyInterviewTab, string> = {
  upcoming: 'Upcoming',
  awaiting: 'Awaiting evaluation',
  submitted: 'Submitted',
  cancelled: 'Cancelled',
};

const EMPTY: Record<MyInterviewTab, { title: string; description: string }> = {
  upcoming: { title: 'Nothing coming up', description: 'Interviews you are assigned to appear here before they happen.' },
  awaiting: { title: 'Nothing waiting on you', description: 'Interviews that have happened and still need your evaluation appear here.' },
  submitted: { title: 'No submitted evaluations yet', description: 'Evaluations you have submitted are kept here for reference.' },
  cancelled: { title: 'No cancelled interviews', description: 'Interviews cancelled while you were assigned to them appear here.' },
};

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** What the user wrote for a submitted interview, or where their evaluation stands. */
function EvaluationCell({ row }: { row: MyInterviewHistoryRow }) {
  if (row.status === 'Cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  if (row.evaluationState === 'Submitted') {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {row.recommendation && <Badge variant="success">{row.recommendation}</Badge>}
        {row.overallRating !== null && (
          <span className="text-[length:var(--text-sm)]" aria-label={`Overall rating ${row.overallRating} out of 5`}>
            {row.overallRating}/5
          </span>
        )}
      </span>
    );
  }
  if (row.evaluationState === 'Draft') return <Badge variant="warning">Draft</Badge>;
  return <Badge variant="neutral">Not started</Badge>;
}

/**
 * The interviews the signed-in user is assigned to, a tab at a time: upcoming, awaiting their evaluation, submitted
 * (with the recommendation and rating they gave) and cancelled. Open to every role, because it only ever shows the
 * user's own assignments. Tab, search and page live in the URL, so a refresh or a link lands in the same place.
 */
export default function MyInterviewsPage() {
  const tabs: TabDef[] = TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id] }));
  const [tab] = useTabs(tabs);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || 20;
  const [searchInput, setSearchInput] = useState(search);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-interview-history', { tab, search, page, pageSize }],
    queryFn: () => getMyInterviewHistory({ tab: tab as MyInterviewTab, search: search || undefined, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  // The counts describe every tab, so they ride on the labels whichever tab is open.
  const labelled: TabDef[] = tabs.map((t) => ({
    ...t,
    label: data ? `${t.label} (${data.counts[t.id as MyInterviewTab]})` : t.label,
  }));

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ q: searchInput.trim() || null, page: null });
  };

  return (
    <Page>
      <Tabs
        tabs={labelled}
        active={tab}
        onChange={(id) => setParams({ tab: id, page: null })}
        ariaLabel="My interviews"
      />

      <TabPanel id={tab}>
        <form onSubmit={applySearch} className="data-toolbar__search" role="search">
          <SearchInput
            placeholder="Search by candidate name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search my interviews"
          />
        </form>

        {isLoading ? (
          <LoadingPanel label="Loading your interviews…" />
        ) : isError || !data ? (
          <EmptyState variant="error" title="Could not load your interviews" description="Try again in a moment." />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={28} />}
            title={search ? 'No interviews match your search' : EMPTY[tab as MyInterviewTab].title}
            description={search ? 'Try a different name, or clear the search.' : EMPTY[tab as MyInterviewTab].description}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-cards align-middle">
                <thead>
                  <tr>
                    <th className="text-left">Candidate</th>
                    <th className="text-left">Role</th>
                    <th className="text-left">When</th>
                    <th className="text-left">Your evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Candidate">
                        <Link to={`/interviews/${row.id}`}>{row.candidateName}</Link>
                      </td>
                      <td data-label="Role">{row.role ?? 'No role'}</td>
                      <td data-label="When">{formatWhen(row.scheduledAt)}</td>
                      <td data-label="Your evaluation">
                        <EvaluationCell row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              totalCount={data.totalCount}
              onPageChange={(p) => setParams({ page: p > 1 ? String(p) : null })}
              pageSizeOptions={[10, 20, 50, 100]}
              onPageSizeChange={(sz) => setParams({ pageSize: sz !== 20 ? String(sz) : null, page: null })}
              noun="interview"
            />
          </>
        )}
      </TabPanel>
    </Page>
  );
}
