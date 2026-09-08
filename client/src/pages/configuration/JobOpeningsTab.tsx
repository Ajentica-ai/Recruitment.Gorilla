import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  createRoleOption,
  deleteRoleOption,
  getEvaluationRubrics,
  getRecruiterOptions,
  getRoleOptions,
  updateRoleOption,
} from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ToastStack';
import SearchableDropdown, { SearchableMultiSelect } from '../../components/SearchableSelect';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonRows } from '../../components/common/Loading';
import { skillColorModifier } from '../../utils/skillColors';
import {
  JOB_STATUS_BADGE,
  daysUntil,
  elapsedPercent,
  jobStatus,
  type JobStatus,
} from '../../utils/jobStatus';
import type { UpsertOptionPayload } from '../../types';
import type { Opt } from './types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckboxField } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PRIORITIES = ['High', 'Medium', 'Low'];
const LOCATIONS = ['Remote', 'Office', 'Hybrid', 'Contractual'];
const DEPARTMENTS = ['Engineering', 'Admin', 'HR'];

const STATUS_FILTERS: { id: 'all' | JobStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closing-soon', label: 'Closing soon' },
  { id: 'closed', label: 'Closed' },
  { id: 'inactive', label: 'Inactive' },
];

/** ISO string → value for <input type="datetime-local"> (local time, no seconds). */
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const jobId = (id: number) => `JOB-${String(id).padStart(3, '0')}`;

const priorityClass = (p?: string | null) => {
  const key = (p ?? '').toLowerCase();
  return key === 'high' || key === 'medium' || key === 'low' ? `priority--${key}` : null;
};

export default function JobOpeningsTab() {
  const { addToast } = useToast();
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [editing, setEditing] = useState<Opt | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<Opt | null>(null);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recruiterUserIds, setRecruiterUserIds] = useState<number[]>([]);
  const [evaluationRubricId, setEvaluationRubricId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [endDateInvalid, setEndDateInvalid] = useState(false);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['config', 'roles', 'all'],
    queryFn: () => getRoleOptions(true),
  });

  const { data: users = [] } = useQuery({ queryKey: ['recruiter-options'], queryFn: getRecruiterOptions });

  const { data: rubrics = [] } = useQuery({
    queryKey: ['evaluation-rubrics'],
    queryFn: getEvaluationRubrics,
  });

  const rubricOptions = useMemo(() => {
    return rubrics
      .filter((r) => r.isActive || r.id === editing?.evaluationRubricId)
      .map((r) => ({
        id: r.id,
        name: r.name,
        badge: r.isDefault ? 'Default' : undefined,
      }));
  }, [rubrics, editing]);

  const recruiterOptions = useMemo(() => {
    // Label carries name + email so the searchable select matches on either.
    const eligible = users.map((u) => ({ id: u.id, name: `${u.name} (${u.email})` }));
    // Openings saved before this list was restricted may still hold users who can't write
    // candidates. Keep them in the options so they render as chips and can be removed —
    // otherwise they'd be invisible here yet still submitted, and the save would fail.
    const legacy = (editing?.recruiters ?? [])
      .filter((r) => !users.some((u) => u.id === r.userId))
      .map((r) => ({ id: r.userId, name: `${r.name} — no candidate access` }));
    return [...eligible, ...legacy];
  }, [users, editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['config'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: UpsertOptionPayload = {
        name: name.trim(),
        // Sort order is no longer a field anyone types. New openings go to the
        // end; editing an existing one leaves its position alone.
        sortOrder: editing ? editing.sortOrder : (options.at(-1)?.sortOrder ?? 0) + 1,
        isActive,
        location: location || null,
        department: department || null,
        priority: priority || null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        recruiterUserIds,
        evaluationRubricId: evaluationRubricId || null,
      };
      return editing ? updateRoleOption(editing.id, payload) : createRoleOption(payload);
    },
    onSuccess: () => {
      void invalidate();
      addToast(editing ? 'Job opening updated.' : 'Job opening added.');
      setShowModal(false);
    },
    // A 400 carries the server's reason as a plain string (e.g. an ineligible recruiter) — show it
    // rather than the generic guess, which would otherwise hide why the save was rejected.
    onError: (err) => {
      const body = isAxiosError(err) && err.response?.status === 400 ? err.response.data : null;
      setError(typeof body === 'string' && body ? body : 'Could not save the job opening. The name may already exist.');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteRoleOption(id),
    onSuccess: (result) => {
      void invalidate();
      if (result && 'deactivated' in result && result.deactivated) {
        addToast(
          `That role has ${result.candidateCount} assigned candidate(s) — it was deactivated instead of deleted.`,
          'warning',
        );
      } else {
        addToast('Job opening deleted.');
      }
      setDeleting(null);
    },
    onError: () => {
      addToast('Could not delete the job opening.', 'danger');
      setDeleting(null);
    },
  });

  const resetForm = (o: Opt | null) => {
    setEditing(o);
    setName(o?.name ?? '');
    setIsActive(o?.isActive ?? true);
    setLocation(o?.location ?? '');
    setDepartment(o?.department ?? '');
    setPriority(o?.priority ?? '');
    setEndDate(o?.endDate ? toLocalInput(o.endDate) : '');
    setRecruiterUserIds((o?.recruiters ?? []).map((r) => r.userId));
    setEvaluationRubricId(o?.evaluationRubricId ?? null);
    setError(null);
    setNameInvalid(false);
    setEndDateInvalid(false);
    setShowModal(true);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (statusFilter !== 'all' && jobStatus(o) !== statusFilter) return false;
      if (!q) return true;
      const haystack = [o.name, o.department, o.location, o.priority, ...(o.recruiters ?? []).map((r) => r.name)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query, statusFilter]);

  return (
    <>
      {/* The action shares the filter row rather than taking one of its own
          — see .page-bar. */}
      <div className="data-toolbar">
        <SearchInput
          wrapperClassName="!max-w-[420px] !flex-[1_1_320px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search role, recruiter or department…"
          aria-label="Search job openings"
          className="h-10 text-sm pl-9"
        />
        <div className="data-toolbar__end">
          <div className="segmented" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={statusFilter === f.id}
                className={statusFilter === f.id ? 'active' : ''}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="toolbar-divider hidden sm:block" />
          <Button size="sm" onClick={() => resetForm(null)} className="shrink-0 gap-1.5">
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            <span>Add job opening</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} label="Loading job openings" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} strokeWidth={1.75} aria-hidden="true" />}
          title={options.length === 0 ? 'No job openings yet' : 'No openings match these filters'}
          description={
            options.length === 0
              ? 'Add one to make it selectable on candidate forms and visible on the dashboard.'
              : 'Try a different status, or clear the search.'
          }
          action={
            options.length === 0 ? (
              <Button onClick={() => resetForm(null)}>Add job opening</Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => { setQuery(''); setStatusFilter('all'); }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="job-list">
          {visible.map((o) => (
            <JobRow
              key={o.id}
              job={o}
              canDelete={isSuperAdmin}
              onEdit={() => resetForm(o)}
              onDelete={() => setDeleting(o)}
            />
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { (() => setShowModal(false))(); } }}>
<DialogContent className="sm:max-w-2xl">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            let bad = false;
            if (!name.trim()) { setNameInvalid(true); bad = true; }
            if (!endDate) { setEndDateInvalid(true); bad = true; }
            if (bad) { setError(null); return; }
            saveMutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit job opening' : 'Add job opening'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {error && (
              <div className="alert-danger-soft mb-6" role="alert">
                {error}
              </div>
            )}

            {/* Title and Posted date used to sit here as readOnly plaintext
                fields, which rendered borderless and read as broken. Both are
                derived and both are shown on the card, so they are gone. */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <Label>Role name <span className="required-star" aria-hidden="true">*</span></Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameInvalid) setNameInvalid(false); }}
                  aria-invalid={nameInvalid || undefined}
                  autoFocus
                />
                {nameInvalid && (
                  <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">Role name is required.</p>
                )}
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label>Closes <span className="required-star" aria-hidden="true">*</span></Label>
                <DatePicker
                  withTime
                  value={endDate}
                  onChange={(v) => { setEndDate(v); if (endDateInvalid) setEndDateInvalid(false); }}
                  aria-invalid={endDateInvalid || undefined}
                />
                {endDateInvalid && (
                  <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">A closing date is required.</p>
                )}
                {editing?.createdAt && (
                  <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Posted {formatDate(editing.createdAt)}.</p>
                )}
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label>Priority</Label>
                <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="">None</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </NativeSelect>
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label>Location</Label>
                <NativeSelect value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="">None</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </NativeSelect>
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label>Department</Label>
                <NativeSelect value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">None</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </NativeSelect>
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label>Evaluation rubric</Label>
                <SearchableDropdown<number>
                  options={rubricOptions}
                  value={evaluationRubricId}
                  onChange={setEvaluationRubricId}
                  placeholder="System default rubric"
                  emptyMessage="No rubric found"
                  clearable
                />
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
                  Determines the scorecard criteria and sections for candidates in this opening.
                </p>
              </div>
              <div className="col-span-12">
                <Label>Recruiters</Label>
                <SearchableMultiSelect
                  options={recruiterOptions}
                  value={recruiterUserIds}
                  onChange={setRecruiterUserIds}
                  placeholder="Search by name or email…"
                />
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
                  Each assigned recruiter can access every candidate under this role. Only users with
                  the Recruiter role or higher are listed — an Interviewer would gain no access.
                </p>
              </div>
              <div className="col-span-12">
                <CheckboxField id="job-active" label="Active — shown in candidate forms and on the dashboard" checked={isActive} onCheckedChange={(checked) => setIsActive(checked)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
</Dialog>

      {/* The shared confirm dialog rather than a fourth hand-rolled copy of the
          same three elements. */}
      <ConfirmModal
        show={deleting !== null}
        title="Delete job opening"
        pending={removeMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && removeMutation.mutate(deleting.id)}
      >
        Delete <strong>{deleting?.name}</strong>? If any candidates are assigned to this role, it
        will be <strong>deactivated</strong> (kept for history) instead of permanently deleted.
      </ConfirmModal>
    </>
  );
}

/** The bar tracks time, so it takes the colour of the status it is tracking. */
const BAR_FILL: Record<JobStatus, string> = {
  open: 'var(--primary)',
  'closing-soon': 'var(--warning)',
  closed: 'var(--danger)',
  inactive: 'var(--muted-light)',
};

/** "Days left" for the numeric slot: a bare number needs a word to be a fact. */
function daysLeftLabel(status: JobStatus, days: number | null): { label: string; value: string } {
  if (status === 'inactive') return { label: 'Status', value: 'Off' };
  if (days === null) return { label: 'Closes', value: 'No date' };
  if (days < 0) return { label: 'Closed', value: `${Math.abs(days)}d ago` };
  if (days === 0) return { label: 'Closes', value: 'Today' };
  return { label: 'Days left', value: String(days) };
}

/**
 * One opening as a full-width row: identity, status, a days-left figure, and
 * progress through the posting window.
 *
 * The whole row opens the edit dialog, so it is a <button>; the delete control
 * inside it stops propagation rather than nesting an interactive element in
 * another one.
 */
function JobRow({
  job,
  canDelete,
  onEdit,
  onDelete,
}: {
  job: Opt;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = jobStatus(job);
  const badge = JOB_STATUS_BADGE[status];
  const recruiters = job.recruiters ?? [];
  const prio = priorityClass(job.priority);
  const days = daysUntil(job.endDate);
  const gauge = daysLeftLabel(status, days);
  const pct = elapsedPercent(job.createdAt, job.endDate);
  const dim = status === 'closed' || status === 'inactive';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      aria-label={`Edit ${job.name}`}
      className={`job-row${dim ? ' job-row--dim' : ''}`}
    >
      <div className="job-row__main">
        <div className="job-row__name">{job.name}</div>
        <div className="job-row__meta">
          <span className={`dept-tag ${skillColorModifier(job.department ?? 'Unassigned')}`}>
            {job.department ?? 'Unassigned'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="job-card__id">{jobId(job.id)}</span>
          <span aria-hidden="true">·</span>
          <span>{job.location ?? 'Location not set'}</span>
          <span aria-hidden="true">·</span>
          <span title={recruiters.map((r) => r.name).join(', ') || undefined}>
            {recruiters.length === 0
              ? 'No recruiters'
              : `${recruiters.length} recruiter${recruiters.length === 1 ? '' : 's'}`}
          </span>
          {job.evaluationRubricName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-muted-foreground" title="Assigned scorecard rubric">
                Rubric: {job.evaluationRubricName}
              </span>
            </>
          )}
          {prio && <span className={`priority-badge ${prio}`}>{job.priority}</span>}
        </div>
      </div>

      <div className="job-row__metrics">
        <div className="job-row__status">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="job-row__gauge">
            {gauge.label}
            <span className="job-row__gauge-value">{gauge.value}</span>
          </span>
        </div>

        <div className="job-row__closes">
          <span className="job-row__meta-label">{status === 'closed' ? 'Closed' : 'Closes'}</span>
          <span className="job-row__closes-value">{formatDate(job.endDate)}</span>
          {/* Omitted rather than drawn empty when the window can't be computed —
              "unknown" and "0%" must not look the same. */}
          {pct !== null && (
            <div className="job-row__bar-row">
              <span
                className="job-row__bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Posting window elapsed"
              >
                <i style={{ width: `${pct}%`, ['--bar-fill' as string]: BAR_FILL[status] }} />
              </span>
              <span className="job-row__pct">{pct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="job-row__actions">
        {/* Ghost, not outline-danger: a red-outlined button on every row made
            "delete this opening" the most emphatic control on the page. It
            turns red under the pointer, which is when the warning is useful. */}
        {canDelete && (
          <Button
            size="sm"
            variant="ghostDestructive"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            aria-label={`Delete ${job.name}`}
          >
            <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        )}
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="job-row__chevron" />
      </div>
    </div>
  );
}
