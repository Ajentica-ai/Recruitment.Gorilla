import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { getPipelineJobs } from '../services/api';
import Page from '../components/common/Page';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import { SkeletonRows } from '../components/common/Loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { NativeSelect } from '@/components/ui/native-select';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import {
  JOB_STATUS_BADGE,
  daysUntil,
  elapsedPercent,
  jobStatus,
  type JobStatus,
} from '../utils/jobStatus';

const STATUS_OPTIONS: { id: 'all' | JobStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closing-soon', label: 'Closing soon' },
  { id: 'closed', label: 'Closed' },
  { id: 'inactive', label: 'Inactive' },
];

const PRIORITY_BADGES: Record<string, { tone: string; border: string }> = {
  High: { tone: 'text-[var(--danger-text)] bg-[var(--danger-subtle)]', border: 'border-red-200 dark:border-red-900/40' },
  Medium: { tone: 'text-[var(--warning-text)] bg-[var(--warning-subtle)]', border: 'border-amber-200 dark:border-amber-900/40' },
  Low: { tone: 'text-muted-foreground bg-secondary', border: 'border-border' },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['pipeline-jobs'],
    queryFn: getPipelineJobs,
  });

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.department?.trim()) set.add(j.department.trim());
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Aggregate KPI stats across jobs
  const stats = useMemo(() => {
    let openCount = 0;
    let closingSoonCount = 0;
    let totalCandidates = 0;

    jobs.forEach((job) => {
      const st = jobStatus(job);
      if (st === 'open') openCount++;
      if (st === 'closing-soon') closingSoonCount++;
      totalCandidates += job.candidateCount ?? 0;
    });

    return {
      total: jobs.length,
      active: openCount + closingSoonCount,
      closingSoon: closingSoonCount,
      totalCandidates,
    };
  }, [jobs]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const st = jobStatus(job);

      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (departmentFilter !== 'all' && (job.department || '') !== departmentFilter) return false;
      if (priorityFilter !== 'all' && (job.priority || '') !== priorityFilter) return false;

      if (q) {
        const matchesName = job.name.toLowerCase().includes(q);
        const matchesDept = (job.department || '').toLowerCase().includes(q);
        const matchesLoc = (job.location || '').toLowerCase().includes(q);
        const matchesRubric = (job.evaluationRubricName || '').toLowerCase().includes(q);
        const matchesRecruiter = job.recruiters.some((r) => r.name.toLowerCase().includes(q));
        if (!matchesName && !matchesDept && !matchesLoc && !matchesRubric && !matchesRecruiter) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, search, statusFilter, departmentFilter, priorityFilter]);

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || departmentFilter !== 'all' || priorityFilter !== 'all';

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, departmentFilter, priorityFilter]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const pagedJobs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPriorityFilter('all');
    setPage(1);
  };

  return (
    <Page>
      <div className="flex flex-col gap-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-primary" strokeWidth={2} />
              Job Openings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Active openings across departments, required scorecard rubrics, and candidate pipelines.
            </p>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Positions</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-foreground">{stats.total}</span>
              <span className="text-xs font-medium text-muted-foreground">openings</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active Openings
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-foreground">{stats.active}</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">accepting CVs</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Closing Soon
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-foreground">{stats.closingSoon}</span>
              <span className="text-xs font-medium text-muted-foreground">&lt; 7 days left</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Pipeline Candidates
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-primary">{stats.totalCandidates}</span>
              <span className="text-xs font-medium text-primary/80">total applied</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="data-toolbar flex-wrap gap-2.5 bg-card/60 p-2.5 rounded-xl border border-border/80">
          <div className="w-full sm:w-80 md:w-96 lg:w-[480px] xl:w-[520px]">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, department, location, recruiter…"
              aria-label="Search job openings"
              className="h-10 text-sm pl-9 rounded-lg bg-card/90"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <Segmented
              type="single"
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v as 'all' | JobStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <SegmentedItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SegmentedItem>
              ))}
            </Segmented>
          </div>

          {departments.length > 0 && (
            <div className="w-36">
              <NativeSelect
                size="sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                aria-label="Filter by department"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="w-32">
            <NativeSelect
              size="sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </NativeSelect>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Reset filters
            </Button>
          )}
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonRows rows={4} />
          </div>
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Unable to load job openings"
            description="There was an error communicating with the server. Please try refreshing."
            action={<Button onClick={() => refetch()} variant="outline">Try again</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-6 h-6 text-muted-foreground" />}
            title={hasActiveFilters ? 'No openings match your filters' : 'No job openings posted yet'}
            description={
              hasActiveFilters
                ? 'Try broadening your search or resetting active filters.'
                : 'Job openings configured by your administrators will appear here with live candidate counts.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          /* Job Openings Catalog Grid */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pagedJobs.map((job) => {
                const status = jobStatus(job);
                const badgeDef = JOB_STATUS_BADGE[status];
                const remainingDays = daysUntil(job.endDate);
                const progressPct = elapsedPercent(job.createdAt, job.endDate);
                const prio = job.priority ? PRIORITY_BADGES[job.priority] : null;
                const count = job.candidateCount ?? 0;

              return (
                <div
                  key={job.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
                >
                  {/* Card Top: Badges & Title */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={badgeDef.variant}>
                          {badgeDef.label}
                        </Badge>
                        {job.priority && prio && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${prio.tone} ${prio.border}`}>
                            {job.priority}
                          </span>
                        )}
                      </div>

                      {/* Posted date */}
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {job.name}
                    </h2>

                    {/* Department & Location */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      {job.department && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                          {job.department}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/70" />
                          {job.location}
                        </span>
                      )}
                    </div>

                    {/* Rubric Tag if attached */}
                    {job.evaluationRubricName && (
                      <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/80 text-[11px] text-muted-foreground font-medium">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="truncate max-w-[200px]" title={job.evaluationRubricName}>
                          {job.evaluationRubricName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Middle: Timeline Deadline Progress */}
                  <div className="my-4 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {remainingDays !== null && remainingDays > 0 ? (
                          <span className={status === 'closing-soon' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                            {remainingDays} {remainingDays === 1 ? 'day' : 'days'} remaining
                          </span>
                        ) : status === 'closed' ? (
                          <span className="text-red-500 font-medium">Deadline passed</span>
                        ) : (
                          <span>Target: {new Date(job.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                      </span>
                      {progressPct !== null && (
                        <span className="text-[11px] font-mono text-muted-foreground">{progressPct}% elapsed</span>
                      )}
                    </div>

                    {progressPct !== null && (
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            status === 'closing-soon'
                              ? 'bg-amber-500'
                              : status === 'closed'
                              ? 'bg-red-500'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Candidate Count & Assigned Recruiters */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
                    {/* Recruiters stack */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {job.recruiters.length > 0 ? (
                        <div className="flex items-center -space-x-2 overflow-hidden">
                          {job.recruiters.slice(0, 3).map((r) => (
                            <Avatar
                              key={r.userId}
                              name={r.name}
                              size="sm"
                              className="border-2 border-card ring-1 ring-border/20 shadow-xs"
                            />
                          ))}
                          {job.recruiters.length > 3 && (
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-[10px] font-bold text-muted-foreground border-2 border-card">
                              +{job.recruiters.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Unassigned</span>
                      )}
                    </div>

                    {/* Candidate Count & View Action */}
                    <Link
                      to={`/candidates?role=${job.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors group/link"
                      title={`View all ${count} candidates for ${job.name}`}
                    >
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>{count} {count === 1 ? 'Candidate' : 'Candidates'}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <Pagination
                  page={safePage}
                  pageSize={pageSize}
                  totalCount={filtered.length}
                  onPageChange={setPage}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  noun="job opening"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
