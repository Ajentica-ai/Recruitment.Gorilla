import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronsUpDown, Kanban, List, Trash2, Upload, Users, X } from 'lucide-react';
import {
  deleteCandidate,
  getActiveSkillOptions,
  getCandidateBatches,
  getCandidateFilterRoleOptions,
  getCandidates,
  getStatusOptions,
} from '../services/api';
import SearchableDropdown, { SearchableMultiSelect, type DropdownOption } from '../components/SearchableSelect';
import { StatusBadge } from '../components/StatusBadge';
import { getStatusSolidColor } from '../utils/statusColors';
import KanbanBoard from '../components/kanban/KanbanBoard';
import Avatar from '../components/common/Avatar';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
import Page from '../components/common/Page';
import Pagination from '../components/common/Pagination';
import RowActions, { RowAction } from '../components/common/RowActions';
import { SkeletonRows } from '../components/common/Loading';
import { useAuth } from '../auth/AuthContext';
import type { CandidateListItem } from '../types';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/field';
import { SearchInput } from '@/components/ui/search-input';
import { NativeSelect } from '@/components/ui/native-select';

const DEFAULT_PAGE_SIZE = 10;

/** Sortable columns and the direction each one naturally opens in. */
const SORTS = {
  name: { label: 'Name', natural: 'asc' },
  status: { label: 'Status', natural: 'asc' },
  added: { label: 'Added', natural: 'desc' },
} as const;
type SortKey = keyof typeof SORTS;

/**
 * The `<thead>` is hidden below md (see .table-cards), which would take the
 * sortable headers with it. This select is the small-screen equivalent.
 */
/**
 * Human labels for the dashboard buckets (see the API's CandidateBuckets).
 * Arriving from a KPI tile, the list is filtered by something none of the
 * visible controls represent — so the bucket shows as a removable chip, or the
 * filtered result looks like a bug.
 */
const BUCKET_LABELS: Record<string, string> = {
  'in-process': 'In process',
  recommended: 'Recommended',
  rejected: 'Rejected',
  'new-this-week': 'New this week',
};

const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: 'added:desc', label: 'Newest first' },
  { value: 'added:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'status:asc', label: 'Status A–Z' },
];

export default function CandidatesPage() {
  const { canWriteCandidates, isAdminOrAbove } = useAuth();

  // Filters/sort/page live in the URL so views are bookmarkable and survive refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';
  const roleId = searchParams.get('role') ?? '';
  const skillsCsv = searchParams.get('skills') ?? '';
  const referred = searchParams.get('referred') === '1';
  const batch = searchParams.get('batch') ?? '';
  // Set by the dashboard KPI tiles; see BUCKET_LABELS.
  const bucket = searchParams.get('bucket') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const dir = searchParams.get('dir') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSizeParam = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const skillIds = skillsCsv ? skillsCsv.split(',').map(Number).filter(Number.isFinite) : [];

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]); // keep in sync on back/forward
  const [toDelete, setToDelete] = useState<CandidateListItem | null>(null);

  /** Set/delete URL params; filter changes reset paging, sort changes don't. */
  const setParams = (patch: Record<string, string | null>, resetPage = true) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const hasFilters = !!(search || status || roleId || skillsCsv || referred || bucket || batch);
  const clearFilters = () => {
    setSearchInput('');
    setParams({ q: null, status: null, role: null, skills: null, referred: null, bucket: null, batch: null });
  };

  // Default is Added desc. A first click on a column uses its natural direction;
  // clicking the already-active column flips it.
  const activeSort: SortKey = (sort in SORTS ? sort : 'added') as SortKey;
  const activeDir = dir === 'asc' ? 'asc' : dir === 'desc' ? 'desc' : SORTS[activeSort].natural;
  const applySort = (col: SortKey) =>
    activeSort === col
      ? setParams({ sort: col, dir: activeDir === 'asc' ? 'desc' : 'asc' }, false)
      : setParams({ sort: col, dir: SORTS[col].natural }, false);

  const [viewMode, setViewMode] = useState<'table' | 'board'>(() => {
    return (localStorage.getItem('rg_candidate_view_mode') as 'table' | 'board') || 'table';
  });

  const handleViewModeChange = (mode: 'table' | 'board') => {
    setViewMode(mode);
    localStorage.setItem('rg_candidate_view_mode', mode);
  };

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidates', { search, status, roleId, skillsCsv, referred, bucket, sort, dir, page, viewMode, batch }],
    queryFn: () =>
      getCandidates({
        search: search || undefined,
        status: status || undefined,
        roleId: roleId ? Number(roleId) : undefined,
        skillIds: skillsCsv || undefined,
        referred: referred || undefined,
        bucket: bucket || undefined,
        sort: sort || undefined,
        dir: dir || undefined,
        batch: batch || undefined,
        page: viewMode === 'board' ? 1 : page,
        pageSize: viewMode === 'board' ? 150 : pageSizeParam,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['status-options'],
    queryFn: getStatusOptions,
  });

  // Includes inactive roles, so candidates under a closed opening stay filterable.
  const { data: roleOptions = [] } = useQuery({
    queryKey: ['candidate-filter-roles'],
    queryFn: getCandidateFilterRoleOptions,
  });

  const { data: skillOptions = [] } = useQuery({
    queryKey: ['skill-options', 'active'],
    queryFn: getActiveSkillOptions,
  });

  const statusDropdownOptions: DropdownOption<string>[] = useMemo(() => {
    return statusOptions.map((o) => ({
      id: o.name,
      name: o.name,
      color: getStatusSolidColor(o.name),
    }));
  }, [statusOptions]);

  const { data: batchOptionsList = [] } = useQuery({
    queryKey: ['candidate-batches'],
    queryFn: getCandidateBatches,
  });

  const batchDropdownOptions: DropdownOption<string>[] = useMemo(() => {
    return batchOptionsList.map((b) => ({
      id: b,
      name: b,
    }));
  }, [batchOptionsList]);

  const roleDropdownOptions: DropdownOption<string>[] = useMemo(() => {
    return roleOptions.map((o) => ({
      id: String(o.id),
      name: o.name,
      badge: o.isActive ? undefined : 'Inactive',
    }));
  }, [roleOptions]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCandidate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setToDelete(null);
    },
  });

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ q: searchInput.trim() || null });
  };

  /* Whether the toolbar is about to be followed by the table it filters. Only
     then does it fuse to it — above a skeleton, an error or an empty state it
     stays a card in its own right. */
  const showsTable =
    viewMode === 'table' && !isLoading && !isError && !!data && data.items.length > 0;

  /** A sortable column header. A button, so it's reachable by keyboard. */
  const SortHeader = ({ col }: { col: SortKey }) => {
    const active = activeSort === col;
    const Icon = !active ? ChevronsUpDown : activeDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button type="button" className="th-sort" onClick={() => applySort(col)} aria-label={`Sort by ${SORTS[col].label}`}>
        {SORTS[col].label}
        <Icon size={12} strokeWidth={2} aria-hidden="true" className={active ? undefined : 'th-sort__idle'} />
      </button>
    );
  };

  return (
    <Page>
      <search>
        {/* Fused to the table below it in table mode: the filters and the
            results they filter are one object, so the seam is a rule rather
            than a 20px gap with page background showing through. */}
        <div className={`data-toolbar${showsTable ? ' data-toolbar--attached' : ''}`}>
          {/* The glyph leads the field rather than sitting in a bordered button
              after it. A submit button implied search would not happen without
              it, next to three filters that apply on change; and it is the only
              search box in the app shaped that way — the drafts workspace and
              the job openings tab both use this component. Enter still submits,
              because the form is still a form. */}
          <form onSubmit={applySearch} className="data-toolbar__search" role="search">
            <SearchInput
              placeholder="Search by name, email or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search candidates"
            />
          </form>

          <div className="data-toolbar__field">
            <SearchableDropdown<string>
              options={statusDropdownOptions}
              value={status || null}
              onChange={(val) => setParams({ status: val || null })}
              placeholder="All statuses"
              emptyMessage="No status found"
              clearable
            />
          </div>

          <div className="data-toolbar__field">
            <SearchableDropdown<string>
              options={roleDropdownOptions}
              value={roleId || null}
              onChange={(val) => setParams({ role: val || null })}
              placeholder="All roles"
              emptyMessage="No role found"
              clearable
            />
          </div>

          <div className="data-toolbar__field">
            <SearchableDropdown<string>
              options={batchDropdownOptions}
              value={batch || null}
              onChange={(val) => setParams({ batch: val || null })}
              placeholder="All batches"
              emptyMessage="No batch found"
              clearable
            />
          </div>

          <div className="data-toolbar__field--wide">
            <SearchableMultiSelect
              options={skillOptions}
              value={skillIds}
              onChange={(ids) => setParams({ skills: ids.join(',') || null })}
              placeholder="Filter by skills…"
              showTokens={false}
            />
          </div>

          <div className="data-toolbar__end">
            {/* Small screens hide the table header, and the sortable columns
                with it — this select is the equivalent control there. */}
            <NativeSelect
              wrapperClassName="md:hidden data-toolbar__field"
              aria-label="Sort candidates"
              value={`${activeSort}:${activeDir}`}
              onChange={(e) => {
                const [col, d] = e.target.value.split(':');
                setParams({ sort: col, dir: d }, false);
              }}
            >
              {MOBILE_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>

            <CheckboxField
              id="filter-referred"
              label="Referred only"
              checked={referred}
              onCheckedChange={(checked) => setParams({ referred: checked ? '1' : null })}
              className="h-8 self-center"
            />

            {BUCKET_LABELS[bucket] && (
              <span className="filter-chip h-8 self-center">
                {BUCKET_LABELS[bucket]}
                <button
                  type="button"
                  className="filter-chip__remove"
                  aria-label={`Remove the ${BUCKET_LABELS[bucket]} filter`}
                  onClick={() => setParams({ bucket: null })}
                >
                  <X size={13} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </span>
            )}

            {/* Rendered only when something is filtered */}
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground self-center"
              >
                <X size={13} strokeWidth={2.25} aria-hidden="true" />
                Clear filters
              </Button>
            )}

            <div className="toolbar-divider hidden md:block" />

            {/* A segmented control, not two buttons. Table/Board is one setting
                with two values; rendering the active one as .btn-primary made
                it look like the page's primary action, competing with the one
                button on the row that actually is. */}
            <div className="segmented view-toggle self-center" role="group" aria-label="Candidate view mode">
              <button
                type="button"
                className={viewMode === 'table' ? 'active' : ''}
                aria-pressed={viewMode === 'table'}
                onClick={() => handleViewModeChange('table')}
              >
                <List size={14} strokeWidth={2} aria-hidden="true" />
                Table
              </button>
              <button
                type="button"
                className={viewMode === 'board' ? 'active' : ''}
                aria-pressed={viewMode === 'board'}
                onClick={() => handleViewModeChange('board')}
              >
                <Kanban size={14} strokeWidth={2} aria-hidden="true" />
                Board
              </button>
            </div>

            {canWriteCandidates && (
              <Button asChild size="sm" className="h-8 self-center">
                <Link to="/upload">
                  <Upload strokeWidth={2} aria-hidden="true" />
                  Upload CVs
                </Link>
              </Button>
            )}
          </div>
        </div>
      </search>

      {isLoading ? (
        <SkeletonRows rows={8} label="Loading candidates" />
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load candidates"
          description="The request failed. Refresh the page to try again."
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Users size={20} strokeWidth={1.75} aria-hidden="true" />}
          title={hasFilters ? 'No candidates match these filters' : 'No candidates yet'}
          description={
            hasFilters
              ? 'Try widening the filters, or clear them to see everyone.'
              : 'Upload some CVs to get started — the details are extracted for you to review.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canWriteCandidates ? (
              <Button asChild>
                <Link to="/upload">Upload CVs</Link>
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'board' ? (
        <KanbanBoard
          candidates={data.items}
          isLoading={isLoading}
          canWrite={canWriteCandidates}
        />
      ) : (
        <>
          {/* .table-cards reflows each row into a labelled card below md, so no
              column is hidden on small screens — see index.css. */}
          <div className="table-wrap table-wrap--attached">
            <table className="table table-cards align-middle">
              <thead>
                <tr>
                  <th><SortHeader col="name" /></th>
                  <th>Email</th>
                  <th>Current title</th>
                  <th><SortHeader col="status" /></th>
                  <th><SortHeader col="added" /></th>
                  {/* Delete is Admin/SuperAdmin-only (the API rejects recruiters). */}
                  {isAdminOrAbove && <th className="col-actions"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  /* The whole row opens the candidate. The name stays a real
                     <Link>: that is what keyboard and screen-reader users
                     follow, what the browser shows in the status bar, and what
                     ctrl/middle-click opens in a new tab. This handler is a
                     mouse convenience layered on top of it, so it stands aside
                     for clicks that landed on a control of their own and for
                     modified clicks, which the link already handles. */
                  <tr
                    key={c.id}
                    className="row-clickable"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      if ((e.target as HTMLElement).closest('a, button, input, [role="menu"]')) return;
                      if (window.getSelection()?.toString()) return;
                      navigate(`/candidates/${c.id}`);
                    }}
                  >
                    {/* Avatar + name, with the location and experience the row
                        used to have no room for on its second line. This is
                        what the taller row buys: a candidate is recognisable
                        without reading, and two facts that previously required
                        opening the profile are on the list. */}
                    <td data-label="Name">
                      <div className="cell-identity">
                        <Avatar name={c.fullName} email={c.email} />
                        <span className="cell-identity__text">
                          <Link to={`/candidates/${c.id}`} className="cell-identity__name">
                            {c.fullName}
                          </Link>
                          {(c.appliedRole || c.source || c.batchName) && (
                            <span className="cell-identity__meta">
                              {[c.appliedRole, c.source, c.batchName].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td data-label="Email" className="[overflow-wrap:anywhere]">{c.email}</td>
                    <td data-label="Current title">{c.currentTitle ?? '—'}</td>
                    <td data-label="Status">
                      <StatusBadge status={c.currentStatus} />
                    </td>
                    <td data-label="Added" className="whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {isAdminOrAbove && (
                      <td className="col-actions">
                        <RowActions label={`Actions for ${c.fullName}`}>
                          <RowAction
                            icon={<Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />}
                            tone="danger"
                            onClick={() => setToDelete(c)}
                          >
                            Delete candidate
                          </RowAction>
                        </RowActions>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            onPageChange={(p) => setParams({ page: p > 1 ? String(p) : null }, false)}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageSizeChange={(sz) => setParams({ pageSize: sz !== 10 ? String(sz) : null, page: null }, false)}
            noun="candidate"
          />
        </>
      )}

      <ConfirmModal
        show={toDelete !== null}
        title="Delete candidate"
        pending={deleteMutation.isPending}
        error={deleteMutation.isError ? 'Delete failed. Please try again.' : undefined}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      >
        Permanently delete <strong>{toDelete?.fullName}</strong>, along with their CV file(s) and
        full status history? This cannot be undone.
      </ConfirmModal>
    </Page>
  );
}
