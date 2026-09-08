import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type * as React from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Layers, FileText, ChevronLeft, ChevronRight, RotateCw, Trash2, UserCheck, CheckSquare, Square, Globe, Clock, Sparkles, Copy, Briefcase, Mail, Phone, Plus } from 'lucide-react';
import {
  getCandidateDrafts,
  getCandidateDraft,
  getDraftBatches,
  updateCandidateDraft,
  approveCandidateDraft,
  bulkApproveCandidateDrafts,
  discardCandidateDraft,
  bulkDiscardCandidateDrafts,
  getActiveRoleOptions,
  getActiveSourceOptions,
} from '../../services/api';
import { SearchableSelect } from '../SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { NativeSelect } from '@/components/ui/native-select';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../ToastStack';
import { initials } from '../../utils/initials';
import EmptyState from '../common/EmptyState';
import LoadingPanel from '../common/Loading';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';
import type {
  CandidateDraft,
  ApproveCandidateDraftRequest,
  UpdateCandidateDraftRequest,
} from '../../types';

interface Props {
  initialBatchId?: string | null;
  onCandidateCreated?: () => void;
}

const EXPERIENCE_PRESETS = ['< 1 Year', '1-2 Years', '3-5 Years', '5-8 Years', '8+ Years'];

export default function DraftReviewWorkspace({ initialBatchId, onCandidateCreated }: Props) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [batchFilter, setBatchFilter] = useState<string>(initialBatchId || '');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  /**
   * The floating bulk bar is fixed to the viewport and the studio's footer sits
   * at the bottom of the viewport too, so the two collided: the bar covered
   * "Discard Draft" and "Save Changes".
   *
   * What the footer has to clear is not the bar's height but how much of the
   * viewport's bottom edge the bar occupies — its height PLUS the gap it is
   * offset by. Reserving only the height left the buttons 18px inside the bar,
   * because the bar also sits `--space-6` up from the bottom. Measuring
   * `innerHeight - top` gets both in one number, and keeps working when the bar
   * wraps to two rows on a narrow viewport (44px tall at 1440, 74px at 700).
   */
  const bulkBarRef = useRef<HTMLDivElement | null>(null);
  const [bulkBarInset, setBulkBarInset] = useState(0);
  const [bulkRoleId, setBulkRoleId] = useState<number | null>(null);

  // Form editing state for currently loaded draft
  const [editForm, setEditForm] = useState<Partial<CandidateDraft>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = bulkBarRef.current;
    if (!el) {
      setBulkBarInset(0);
      return;
    }
    const measure = () =>
      setBulkBarInset(Math.max(0, window.innerHeight - el.getBoundingClientRect().top));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // innerHeight is part of the measurement now, so a viewport change matters
    // even when the bar itself does not resize.
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [selectedIds.size]);

  // Sync initialBatchId when provided
  useEffect(() => {
    if (initialBatchId) {
      setBatchFilter(initialBatchId);
    }
  }, [initialBatchId]);

  // Queries
  const { data: batches = [], refetch: refetchBatches } = useQuery({
    queryKey: ['draft-batches'],
    queryFn: getDraftBatches,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['role-options', 'active'],
    queryFn: getActiveRoleOptions,
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['source-options', 'active'],
    queryFn: getActiveSourceOptions,
  });

  const {
    data: draftsDataPage,
    isLoading: isLoadingDrafts,
    refetch: refetchDrafts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['candidate-drafts', statusFilter, batchFilter, roleFilter, searchQuery],
    queryFn: ({ pageParam }) =>
      getCandidateDrafts({
        status: statusFilter,
        batchId: batchFilter || undefined,
        roleId: roleFilter ? Number(roleFilter) : undefined,
        search: searchQuery || undefined,
        pageSize: 50,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
  });

  const drafts = useMemo(() => draftsDataPage?.pages.flatMap((page) => page.items) ?? [], [draftsDataPage]);
  const draftsData = draftsDataPage?.pages[0];

  // Auto-select first draft if none selected or if selected is not in current list
  useEffect(() => {
    if (drafts.length > 0) {
      if (!selectedDraftId || !drafts.some((d) => d.id === selectedDraftId)) {
        setSelectedDraftId(drafts[0].id);
      }
    } else {
      setSelectedDraftId(null);
    }
  }, [drafts, selectedDraftId]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop <= clientHeight + 100) {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  // Fetch full details of the currently selected draft
  const { data: activeDraft, isLoading: isLoadingActiveDraft } = useQuery({
    queryKey: ['candidate-draft', selectedDraftId],
    queryFn: () => (selectedDraftId ? getCandidateDraft(selectedDraftId) : null),
    enabled: selectedDraftId !== null,
  });

  // Populate edit form when active draft changes
  useEffect(() => {
    if (activeDraft) {
      const defaultName =
        activeDraft.fullName?.trim() ||
        activeDraft.originalFileName
          .replace(/\.[^/.]+$/, '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' ');

      setEditForm({
        fullName: defaultName,
        email: activeDraft.email || '',
        phone: activeDraft.phone || '',
        currentTitle: activeDraft.currentTitle || '',
        relevantExperience: activeDraft.relevantExperience || '3-5 Years',
        skills: activeDraft.skills || '',
        summary: activeDraft.summary || '',
        linkedInUrl: activeDraft.linkedInUrl || '',
        githubUrl: activeDraft.githubUrl || '',
        portfolioUrl: activeDraft.portfolioUrl || '',
        location: activeDraft.location || '',
        leetCodeUrl: activeDraft.leetCodeUrl || '',
        codeforcesUrl: activeDraft.codeforcesUrl || '',
        hackerRankUrl: activeDraft.hackerRankUrl || '',
        gitLabUrl: activeDraft.gitLabUrl || '',
        educations: activeDraft.educations || [],
        experiences: activeDraft.experiences || [],
        roleAppliedOptionId: activeDraft.roleAppliedOptionId ?? (roles.length > 0 ? roles[0].id : null),
        sourceOptionId: activeDraft.sourceOptionId,
        sourceDetail: activeDraft.sourceDetail || '',
      });
      setFormErrors({});
    }
  }, [activeDraft, roles]);

  useEffect(() => {
    if (roles.length > 0 && !editForm.roleAppliedOptionId) {
      setEditForm((prev) => ({
        ...prev,
        roleAppliedOptionId: prev.roleAppliedOptionId ?? roles[0].id,
      }));
    }
  }, [roles, editForm.roleAppliedOptionId]);

  // Next / Previous navigation in queue
  const currentIndex = drafts.findIndex((d) => d.id === selectedDraftId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < drafts.length - 1;

  const navigateQueue = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev' && hasPrev) {
        setSelectedDraftId(drafts[currentIndex - 1].id);
        setMobileDetailOpen(true);
      } else if (direction === 'next' && hasNext) {
        setSelectedDraftId(drafts[currentIndex + 1].id);
        setMobileDetailOpen(true);
      }
    },
    [currentIndex, drafts, hasNext, hasPrev]
  );

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateQueue('prev');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateQueue('next');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        // Quick approve
        e.preventDefault();
        handleApprove();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ApproveCandidateDraftRequest }) => {
      return approveCandidateDraft(id, payload);
    },
    onSuccess: (data) => {
      addToast(data.message || 'Candidate approved & created successfully!', 'success');
      void queryClient.invalidateQueries({ queryKey: ['candidate-drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['draft-batches'] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['recruiting-analytics'] });
      onCandidateCreated?.();

      if (hasNext) {
        setSelectedDraftId(drafts[currentIndex + 1].id);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data || err.message || 'Failed to approve draft.';
      addToast(msg, 'danger');
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (id: number) => {
      return discardCandidateDraft(id);
    },
    onSuccess: () => {
      addToast('Draft marked as discarded.', 'info');
      void queryClient.invalidateQueries({ queryKey: ['candidate-drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['draft-batches'] });

      if (hasNext) {
        setSelectedDraftId(drafts[currentIndex + 1].id);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data || err.message || 'Failed to discard draft.';
      addToast(msg, 'danger');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateCandidateDraftRequest }) => {
      return updateCandidateDraft(id, payload);
    },
    onSuccess: () => {
      addToast('Draft changes saved.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['candidate-drafts'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data || 'Failed to update draft.', 'danger');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      return bulkApproveCandidateDrafts({
        draftIds: Array.from(selectedIds),
        defaultRoleAppliedOptionId: bulkRoleId || undefined,
      });
    },
    onSuccess: (data) => {
      addToast(`Batch approved ${data.approvedCount} candidate(s)!`, 'success');
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ['candidate-drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['draft-batches'] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      onCandidateCreated?.();
    },
    onError: (err: any) => {
      addToast(err?.response?.data || 'Bulk approval failed.', 'danger');
    },
  });

  const bulkDiscardMutation = useMutation({
    mutationFn: async () => {
      return bulkDiscardCandidateDrafts({
        draftIds: Array.from(selectedIds),
      });
    },
    onSuccess: (data) => {
      addToast(`Discarded ${data.discardedCount} draft(s).`, 'info');
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ['candidate-drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['draft-batches'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data || 'Bulk discard failed.', 'danger');
    },
  });

  // Handle Approve Action
  const handleApprove = () => {
    if (!activeDraft) return;

    const errors: Record<string, string> = {};
    if (!editForm.fullName?.trim()) errors.fullName = 'Full name is required.';
    if (!editForm.email?.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(editForm.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!editForm.roleAppliedOptionId) {
      errors.role = 'Please assign an applied role before approving.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      addToast('Please complete required fields before approving.', 'warning');
      return;
    }

    approveMutation.mutate({
      id: activeDraft.id,
      payload: {
        fullName: editForm.fullName!.trim(),
        email: editForm.email!.trim(),
        phone: editForm.phone?.trim() || null,
        currentTitle: editForm.currentTitle?.trim() || null,
        relevantExperience: editForm.relevantExperience?.trim() || '0 Years',
        skills: editForm.skills?.trim() || null,
        summary: editForm.summary?.trim() || null,
        linkedInUrl: editForm.linkedInUrl?.trim() || null,
        githubUrl: editForm.githubUrl?.trim() || null,
        portfolioUrl: editForm.portfolioUrl?.trim() || null,
        location: editForm.location?.trim() || null,
        leetCodeUrl: editForm.leetCodeUrl?.trim() || null,
        codeforcesUrl: editForm.codeforcesUrl?.trim() || null,
        hackerRankUrl: editForm.hackerRankUrl?.trim() || null,
        gitLabUrl: editForm.gitLabUrl?.trim() || null,
        educations: editForm.educations || [],
        experiences: editForm.experiences || [],
        roleAppliedOptionId: editForm.roleAppliedOptionId!,
        sourceOptionId: editForm.sourceOptionId || null,
        sourceDetail: editForm.sourceDetail?.trim() || null,
      },
    });
  };

  // Toggle selection for bulk actions
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast(`Copied ${label} to clipboard!`, 'info');
  };

  const selectedDraftsList = useMemo(() => drafts.filter((d) => selectedIds.has(d.id)), [drafts, selectedIds]);
  const showApproveBulk = selectedDraftsList.some((d) => d.status !== 'Approved');
  const showDiscardBulk = selectedDraftsList.some((d) => d.status !== 'Discarded');

  return (
    <div
      className="draft-workspace"
      style={{ '--bulk-bar-inset': `${bulkBarInset}px` } as React.CSSProperties}
    >
      {/* 1. Header Toolbar & Command Row */}
      <div className="draft-toolbar">
        <div className="draft-toolbar__left">
          {/* Status Filter Chips */}
          <Segmented
            type="single"
            value={statusFilter}
            // Radix lets a single-type group be deselected, which would leave the queue
            // with no status filter at all. There is no "all statuses" view here, so an
            // empty value is ignored rather than stored.
            onValueChange={(v) => v && setStatusFilter(v)}
            aria-label="Filter drafts by status"
          >
            <SegmentedItem value="Pending">
              <Clock className="text-warning-foreground" />
              Pending
              <Badge variant="neutral">{draftsData?.totalPending ?? 0}</Badge>
            </SegmentedItem>
            <SegmentedItem value="Approved">
              <CheckCircle2 className="text-success-foreground" />
              Approved
              <Badge variant="neutral">{draftsData?.totalApproved ?? 0}</Badge>
            </SegmentedItem>
            <SegmentedItem value="Discarded">
              <XCircle className="text-[var(--danger-text)]" />
              Discarded
              <Badge variant="neutral">{draftsData?.totalDiscarded ?? 0}</Badge>
            </SegmentedItem>
          </Segmented>
        </div>

        <div className="draft-toolbar__right">
          {/* Job Opening Selector */}
          <NativeSelect
            size="sm"
            wrapperClassName="draft-batch-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by Job Opening"
          >
            <option value="">All Job Openings</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>

          {/* Batch Selector */}
          {batches.length > 0 && (
            <NativeSelect
              size="sm"
              wrapperClassName="draft-batch-select"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              aria-label="Filter by Batch"
            >
              <option value="">All Upload Batches ({batches.reduce((acc, b) => acc + b.totalDrafts, 0)})</option>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchName || b.batchId} ({b.pendingDrafts} pending / {b.totalDrafts} total)
                </option>
              ))}
            </NativeSelect>
          )}

          {/* Search Bar + Refresh */}
          <div className="draft-search-wrap flex items-center gap-2 grow">
            <SearchInput
              wrapperClassName="draft-search-field grow"
              className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
              placeholder="Search candidate, role, skills…"
              aria-label="Search drafts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <Button
              variant="outline"
              size="iconSm"
              className="shrink-0"
              onClick={() => {
                void refetchDrafts();
                void refetchBatches();
              }}
              title="Refresh Drafts"
              aria-label="Refresh drafts"
            >
              <RotateCw />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Workspace Split-Screen: Master Rail + Studio */}
      <div className="draft-split-view">
        {/* LEFT RAIL: Queue Cards List */}
        <div className={cn('draft-list-rail', mobileDetailOpen ? 'hidden lg:flex' : 'flex')}>
          <div className="flex items-stretch justify-between border-b border-border shrink-0 bg-card">
            <div 
              className="flex items-center justify-center shrink-0"
              style={{ width: '36px', borderRight: '1px solid var(--border)' }}
            >
              <Button
                variant="ghost"
                size="iconSm"
                onClick={toggleSelectAll}
                title={selectedIds.size === drafts.length ? 'Deselect all' : 'Select all'}
                aria-label={selectedIds.size === drafts.length ? 'Deselect all' : 'Select all'}
              >
                {selectedIds.size > 0 && selectedIds.size === drafts.length ? (
                  <CheckSquare className="text-brand" />
                ) : (
                  <Square className="text-muted-foreground" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between grow pr-4 pl-2 py-2">
              <span className="text-[length:var(--text-sm)] font-semibold text-muted-foreground">
                {drafts.length} {statusFilter === 'all' ? 'total' : statusFilter.toLowerCase()} candidate{drafts.length === 1 ? '' : 's'}
              </span>
              {drafts.length > 0 && (
                <Badge variant="neutral">
                  {currentIndex >= 0 ? `${currentIndex + 1} / ${drafts.length}` : ''}
                </Badge>
              )}
            </div>
          </div>

          <div className="draft-list-rail__body" onScroll={handleScroll}>
            {isLoadingDrafts ? (
              <LoadingPanel />
            ) : drafts.length === 0 ? (
              <EmptyState
                icon={<Layers size={24} />}
                title="No drafts found"
                description={
                  statusFilter === 'Pending'
                    ? 'All uploaded resumes have been reviewed and approved.'
                    : 'No drafts match the selected filters.'
                }
              />
            ) : (
              drafts.map((d) => {
                const isSelected = d.id === selectedDraftId;
                const isChecked = selectedIds.has(d.id);
                const displayTitle =
                  d.fullName?.trim() ||
                  d.originalFileName
                    .replace(/\.[^/.]+$/, '')
                    .replace(/_/g, ' ')
                    .replace(/-/g, ' ');

                return (
                  <div
                    key={d.id}
                    className={`draft-item-card ${isSelected ? 'draft-item-card--active' : ''} ${isChecked ? 'draft-item-card--checked' : ''} flex items-stretch border-b border-border p-0`}
                    onClick={() => {
                      setSelectedDraftId(d.id);
                      setMobileDetailOpen(true);
                    }}
                  >
                    {/* Dedicated Checkbox Column */}
                    <div 
                      className="draft-item-card__checkbox-col flex items-center justify-center shrink-0"
                      style={{ 
                        width: '36px', 
                        borderRight: '1px solid var(--border)',
                        background: isChecked ? 'var(--primary-tint)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(d.id);
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelect(d.id)}
                        aria-label={`Select ${displayTitle}`}
                      />
                    </div>

                    {/* Main Card Content */}
                    <div className="py-4 pr-4 pl-2 flex items-start gap-2.5 min-w-0 grow">
                      <div className="avatar shrink-0">
                        {initials(displayTitle)}
                      </div>
                      <div className="draft-item-card__content min-w-0 grow">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="draft-item-card__name truncate grow">
                            {displayTitle}
                          </span>
                          {statusFilter === 'all' && (
                            <span
                              className={`${
                                d.status === 'Approved'
                                  ? 'draft-badge--approved'
                                  : d.status === 'Discarded'
                                  ? 'draft-badge--discarded'
                                  : 'draft-badge--pending'
                              } shrink-0`}
                            >
                              {d.status}
                            </span>
                          )}
                        </div>

                        <div className="draft-item-card__role truncate">
                          {d.currentTitle || d.roleAppliedOptionName || 'Unassigned Role'}
                        </div>

                        <div className="draft-item-card__meta min-w-0">
                          <span className="flex items-center gap-1 min-w-0 grow">
                            <FileText size={11} className="shrink-0" />
                            <span className="truncate inline-block min-w-0">{d.originalFileName}</span>
                          </span>
                          <span className="shrink-0 ml-2">
                            {(d.fileSizeBytes / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {isFetchingNextPage && (
              <div className="flex justify-center p-4">
                <Spinner className="text-text-soft" label="Loading more drafts" />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT STUDIO: Candidate Review & Approval Studio */}
        <div className={cn('draft-editor-studio', !mobileDetailOpen ? 'hidden lg:flex' : 'flex')}>
          {isLoadingActiveDraft ? (
            <LoadingPanel />
          ) : !activeDraft ? (
            <div className="draft-editor-studio__empty flex flex-col items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileDetailOpen(false)}
              >
                <ChevronLeft size={16} className="me-1" /> Back to Queue
              </Button>
              <EmptyState
                icon={<FileText size={24} />}
                title="Select a candidate to review"
                description="Pick a resume from the queue on the left to verify parsed fields, assign a role, and approve."
              />
            </div>
          ) : (
            <div className="draft-editor-studio__container">
              {/* Mobile Back-to-Queue Nav Bar */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-surface-muted lg:hidden shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 font-medium -ml-1 text-brand hover:text-brand"
                  onClick={() => setMobileDetailOpen(false)}
                >
                  <ChevronLeft size={16} />
                  Back to Queue
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="iconSm"
                    disabled={!hasPrev}
                    onClick={() => navigateQueue('prev')}
                    aria-label="Previous draft"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs font-semibold px-1 text-muted-foreground">
                    {currentIndex >= 0 ? `${currentIndex + 1} / ${drafts.length}` : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="iconSm"
                    disabled={!hasNext}
                    onClick={() => navigateQueue('next')}
                    aria-label="Next draft"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>

              {/* Studio Hero Header */}
              <div className="draft-editor-studio__head">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="avatar avatar--lg shrink-0 mt-0.5">
                    {initials(editForm.fullName || activeDraft.originalFileName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="mb-1 font-bold text-base md:text-lg leading-tight truncate">
                      {editForm.fullName || activeDraft.originalFileName}
                    </h5>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                      <Badge variant="neutral" className="max-w-full">
                        <FileText size={12} className="shrink-0 mr-1" />
                        <span className="truncate inline-block max-w-[160px] sm:max-w-[280px]">
                          {activeDraft.originalFileName}
                        </span>
                        <span className="shrink-0 ml-1 text-muted-foreground">
                          ({(activeDraft.fileSizeBytes / 1024).toFixed(0)} KB)
                        </span>
                      </Badge>
                      {activeDraft.batchName && (
                        <Badge variant="outline" className="max-w-full">
                          <span className="truncate inline-block max-w-[160px] sm:max-w-[240px]">
                            {activeDraft.batchName}
                          </span>
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs shrink-0">
                        Added {new Date(activeDraft.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Queue Stepper Buttons (Desktop only - mobile uses top return bar) */}
                <div className="hidden lg:flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => navigateQueue('prev')}
                    title="Previous (Ctrl+Left)"
                  >
                    <ChevronLeft />
                    <span className="hidden md:inline">Prev</span>
                  </Button>
                  <Badge variant="neutral">
                    {currentIndex >= 0 ? `${currentIndex + 1} of ${drafts.length}` : ''}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => navigateQueue('next')}
                    title="Next (Ctrl+Right)"
                  >
                    <span className="hidden md:inline">Next</span>
                    <ChevronRight />
                  </Button>
                </div>
              </div>

              {/* Studio Body Form */}
              <div className="draft-editor-studio__body">
                <div className="draft-form-section">
                  <h6 className="draft-form-section__title">
                    <Briefcase size={14} className="text-brand me-1.5" />
                    Candidate Identity &amp; Contact
                  </h6>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Full Name */}
                    <Field
                      className="col-span-12 md:col-span-6"
                      label="Full Name"
                      required
                      error={formErrors.fullName}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="Candidate full name"
                          value={editForm.fullName || ''}
                          onChange={(e) => {
                            setEditForm((prev) => ({ ...prev, fullName: e.target.value }));
                            if (formErrors.fullName) setFormErrors((fe) => ({ ...fe, fullName: '' }));
                          }}
                        />
                      )}
                    </Field>

                    {/* Email */}
                    <Field
                      className="col-span-12 md:col-span-6"
                      label="Email Address"
                      required
                      error={formErrors.email}
                    >
                      {(p) => (
                        <InputGroup aria-invalid={p['aria-invalid']}>
                          <InputGroupAddon>
                            <Mail className="size-3.5" />
                          </InputGroupAddon>
                          <Input
                            {...p}
                            type="email"
                            placeholder="candidate@example.com"
                            value={editForm.email || ''}
                            onChange={(e) => {
                              setEditForm((prev) => ({ ...prev, email: e.target.value }));
                              if (formErrors.email) setFormErrors((fe) => ({ ...fe, email: '' }));
                            }}
                          />
                          {/* Copy sits beside the value it copies rather than in
                              the label, where it pushed the required marker out
                              past it and read as "Copy *". */}
                          {editForm.email && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              className="mr-0.5 shrink-0"
                              onClick={() => copyToClipboard(editForm.email!, 'Email')}
                              title="Copy email address"
                              aria-label="Copy email address"
                            >
                              <Copy />
                            </Button>
                          )}
                        </InputGroup>
                      )}
                    </Field>

                    {/* Current Job Title */}
                    <Field className="col-span-12 md:col-span-6" label="Current / Extracted Job Title">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="e.g. Senior Backend Engineer"
                          value={editForm.currentTitle || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, currentTitle: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    {/* Phone */}
                    <Field className="col-span-12 md:col-span-6" label="Phone Number">
                      {(p) => (
                        <InputGroup>
                          <InputGroupAddon>
                            <Phone className="size-3.5" />
                          </InputGroupAddon>
                          <Input
                            {...p}
                            placeholder="+880 1700-000000"
                            value={editForm.phone || ''}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                          />
                        </InputGroup>
                      )}
                    </Field>

                    {/* Location */}
                    <Field className="col-span-12 md:col-span-6" label="Location (City/Area)">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="e.g. Dhaka, Bangladesh"
                          value={editForm.location || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, location: e.target.value }))
                          }
                        />
                      )}
                    </Field>
                  </div>
                </div>

                <div className="draft-form-section mt-6">
                  <h6 className="draft-form-section__title">
                    <Sparkles size={14} className="text-brand me-1.5" />
                    Application &amp; Job Role Assignment
                  </h6>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Role Applied For */}
                    <Field
                      className="col-span-12 md:col-span-6"
                      label="Role Applied For"
                      required
                      error={formErrors.role}
                    >
                      {() => (
                        <SearchableSelect
                          options={roles.map((r) => ({ id: r.id, name: r.name }))}
                          value={editForm.roleAppliedOptionId || null}
                          onChange={(val) => {
                            setEditForm((prev) => ({ ...prev, roleAppliedOptionId: val as number | null }));
                            if (formErrors.role) setFormErrors((fe) => ({ ...fe, role: '' }));
                          }}
                          placeholder="Select position / job opening..."
                        />
                      )}
                    </Field>

                    {/* Relevant Experience */}
                    <Field className="col-span-12 md:col-span-6" label="Relevant Experience" required>
                      {() => (
                        <>
                          {/* One value out of a fixed set, so it is a segmented control rather
                              than a row of buttons — the old markup rendered the active preset
                              as `btn-primary`, which read as the page's primary action. */}
                          <Segmented
                            type="single"
                            value={
                              EXPERIENCE_PRESETS.includes(editForm.relevantExperience || '')
                                ? (editForm.relevantExperience ?? '')
                                : ''
                            }
                            onValueChange={(v) =>
                              v && setEditForm((prev) => ({ ...prev, relevantExperience: v }))
                            }
                            aria-label="Relevant experience"
                          >
                            {EXPERIENCE_PRESETS.map((preset) => (
                              <SegmentedItem key={preset} value={preset}>
                                {preset}
                              </SegmentedItem>
                            ))}
                          </Segmented>
                          {(!editForm.relevantExperience ||
                            !EXPERIENCE_PRESETS.includes(editForm.relevantExperience)) && (
                            <Input
                              className="mt-2 h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
                              placeholder="e.g. 4 Years"
                              aria-label="Relevant experience, free text"
                              value={editForm.relevantExperience || ''}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, relevantExperience: e.target.value }))
                              }
                            />
                          )}
                        </>
                      )}
                    </Field>

                    {/* Source Option */}
                    <Field className="col-span-12 md:col-span-6" label="Sourcing Channel">
                      {() => (
                        <SearchableSelect
                          options={sources.map((s) => ({ id: s.id, name: s.name }))}
                          value={editForm.sourceOptionId || null}
                          onChange={(val) =>
                            setEditForm((prev) => ({ ...prev, sourceOptionId: val as number | null }))
                          }
                          placeholder="Select source..."
                        />
                      )}
                    </Field>

                    {/* Source Detail */}
                    <Field className="col-span-12 md:col-span-6" label="Source Detail / Campaign">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="e.g. LinkedIn Inbound, Campus 2026"
                          value={editForm.sourceDetail || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, sourceDetail: e.target.value }))
                          }
                        />
                      )}
                    </Field>
                  </div>
                </div>

                <div className="draft-form-section mt-6">
                  <h6 className="draft-form-section__title">
                    <Globe size={14} className="text-brand me-1.5" />
                    Skills, Profile &amp; Bio
                  </h6>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Skills */}
                    <Field className="col-span-12" label="Extracted Skills (Summary)">
                      {(p) => (
                        <>
                          <Input
                            {...p}
                            placeholder="e.g. C#, .NET Core, TypeScript, React, Docker, Kubernetes"
                            value={editForm.skills || ''}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, skills: e.target.value }))}
                          />
                          {editForm.skills && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                          {editForm.skills
                            .split(/[,•|;\n]/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((skill, idx) => (
                              <Badge key={idx} variant="neutral">
                                {skill}
                              </Badge>
                                  ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </Field>

                            {/* Social & Dev Profiles */}
                    <Field className="col-span-12 md:col-span-4" label="LinkedIn Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="linkedin.com/in/..."
                          value={editForm.linkedInUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, linkedInUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-4" label="GitHub Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="github.com/..."
                          value={editForm.githubUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, githubUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-4" label="GitLab Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="gitlab.com/..."
                          value={editForm.gitLabUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, gitLabUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-4" label="LeetCode Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="leetcode.com/u/..."
                          value={editForm.leetCodeUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, leetCodeUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-4" label="Codeforces Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="codeforces.com/profile/..."
                          value={editForm.codeforcesUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, codeforcesUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-4" label="HackerRank Profile">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="hackerrank.com/profile/..."
                          value={editForm.hackerRankUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, hackerRankUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    <Field className="col-span-12 md:col-span-6" label="Portfolio / Personal Website">
                      {(p) => (
                        <Input
                          {...p}
                          placeholder="https://..."
                          value={editForm.portfolioUrl || ''}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))
                          }
                        />
                      )}
                    </Field>

                    {/* Bio / Summary */}
                    <Field className="col-span-12" label="Professional Summary & Bio">
                      {(p) => (
                        <Textarea
                          {...p}
                          rows={3}
                          placeholder="Candidate overview, background summary..."
                          value={editForm.summary || ''}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, summary: e.target.value }))}
                        />
                      )}
                    </Field>
                  </div>
                </div>

                {/* Education Section */}
                <div className="draft-form-section mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h6 className="draft-form-section__title mb-0 border-0 pb-0">
                      <FileText size={14} className="text-brand me-1.5" />
                      Education &amp; Academic Qualifications
                    </h6>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          educations: [
                            ...(prev.educations || []),
                            { degree: 'BSc in CSE', institution: 'University', graduationYear: '2024', cgpa: '' },
                                ],
                              }))
                            }
                          >
                          <Plus />
                          Add Education
                          </Button>
                  </div>

                  {(editForm.educations || []).length === 0 ? (
                    <div className="text-muted-foreground text-[length:var(--text-sm)] py-2">No education records extracted. Click &quot;+ Add Education&quot; to add one.</div>
                  ) : (
                    <div className="flex flex-col gap-4 mt-2">
                      {(editForm.educations || []).map((edu, idx) => (
                        <div key={idx} className="p-4 rounded-[var(--radius-md)] border border-border bg-muted relative">
                          <Button
                            variant="ghostDestructive"
                            size="iconSm"
                            className="absolute top-1.5 right-1.5"
                            onClick={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                educations: prev.educations?.filter((_, i) => i !== idx),
                              }))
                            }
                            title="Remove Education"
                            aria-label="Remove education"
                          >
                            <Trash2 />
                          </Button>
                          <div className="grid grid-cols-12 gap-2">
                            <Field className="col-span-12 md:col-span-6" label="Degree / Major">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. BSc in Computer Science & Engineering"
                                  value={edu.degree}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      educations: prev.educations?.map((item, i) =>
                                        i === idx ? { ...item, degree: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-12 md:col-span-6 pr-6" label="Institution / University">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. BUET, DU, NSU, BRAC University"
                                  value={edu.institution}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      educations: prev.educations?.map((item, i) =>
                                        i === idx ? { ...item, institution: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-6 md:col-span-4" label="Graduation Year">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. 2024"
                                  value={edu.graduationYear || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      educations: prev.educations?.map((item, i) =>
                                        i === idx ? { ...item, graduationYear: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-6 md:col-span-4" label="CGPA / GPA">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. 3.85 / 4.00"
                                  value={edu.cgpa || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      educations: prev.educations?.map((item, i) =>
                                        i === idx ? { ...item, cgpa: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Work Experience Section */}
                <div className="draft-form-section mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h6 className="draft-form-section__title mb-0 border-0 pb-0">
                      <Briefcase size={14} className="text-brand me-1.5" />
                      Work &amp; Employment History
                    </h6>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          experiences: [
                            ...(prev.experiences || []),
                            { jobTitle: 'Software Engineer', company: 'Company Name', duration: '2022 - Present', description: '' },
                                ],
                              }))
                            }
                          >
                          <Plus />
                          Add Experience
                          </Button>
                  </div>

                  {(editForm.experiences || []).length === 0 ? (
                    <div className="text-muted-foreground text-[length:var(--text-sm)] py-2">No work history extracted. Click &quot;+ Add Experience&quot; to add one.</div>
                  ) : (
                    <div className="flex flex-col gap-4 mt-2">
                      {(editForm.experiences || []).map((exp, idx) => (
                        <div key={idx} className="p-4 rounded-[var(--radius-md)] border border-border bg-muted relative">
                          <Button
                            variant="ghostDestructive"
                            size="iconSm"
                            className="absolute top-1.5 right-1.5"
                            onClick={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                experiences: prev.experiences?.filter((_, i) => i !== idx),
                              }))
                            }
                            title="Remove Experience"
                            aria-label="Remove experience"
                          >
                            <Trash2 />
                          </Button>
                          <div className="grid grid-cols-12 gap-2">
                            <Field className="col-span-12 md:col-span-5" label="Job Title">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. Senior Backend Engineer"
                                  value={exp.jobTitle}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      experiences: prev.experiences?.map((item, i) =>
                                        i === idx ? { ...item, jobTitle: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-12 md:col-span-4" label="Company">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. Tech Innovations Ltd"
                                  value={exp.company}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      experiences: prev.experiences?.map((item, i) =>
                                        i === idx ? { ...item, company: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-12 md:col-span-3 pr-6" label="Duration / Dates">
                              {(p) => (
                                <Input
                                  {...p}
                                  placeholder="e.g. Jan 2022 - Present"
                                  value={exp.duration || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      experiences: prev.experiences?.map((item, i) =>
                                        i === idx ? { ...item, duration: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                            <Field className="col-span-12" label="Responsibilities / Highlights">
                              {(p) => (
                                <Textarea
                                  {...p}
                                  rows={2}
                                  placeholder="Key achievements, stack used, responsibilities..."
                                  value={exp.description || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditForm((prev) => ({
                                      ...prev,
                                      experiences: prev.experiences?.map((item, i) =>
                                        i === idx ? { ...item, description: val } : item
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Studio Sticky Footer Actions */}
              <div className="draft-editor-studio__foot">
                <Button
                  variant="ghostDestructive"
                  size="sm"
                  className="gap-1 px-2 sm:px-3 shrink-0 text-xs sm:text-sm"
                  disabled={discardMutation.isPending || activeDraft.status === 'Discarded'}
                  onClick={() => discardMutation.mutate(activeDraft.id)}
                  title="Discard Draft"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Discard Draft</span>
                  <span className="sm:hidden">Discard</span>
                </Button>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2.5 sm:px-3 text-xs sm:text-sm"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: activeDraft.id,
                        payload: editForm,
                      })
                    }
                    title="Save Changes"
                  >
                    {updateMutation.isPending && <Spinner />}
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </Button>

                  <Button
                    size="sm"
                    className="gap-1 px-2.5 sm:px-4 text-xs sm:text-sm font-medium"
                    disabled={approveMutation.isPending || activeDraft.status === 'Approved'}
                    onClick={handleApprove}
                    title="Approve and create candidate (Ctrl+Enter)"
                  >
                    {approveMutation.isPending ? <Spinner /> : <UserCheck size={14} />}
                    {approveMutation.isPending ? (
                      'Approving…'
                    ) : (
                      <>
                        <span className="hidden sm:inline">Approve &amp; Create Candidate</span>
                        <span className="sm:hidden">Approve</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Floating Bulk Action Bar (when multiple items selected) */}
      {selectedIds.size > 0 && (
        <div className="draft-bulk-bar" ref={bulkBarRef}>
          <div className="draft-bulk-bar__content">
            <span className="font-semibold text-[length:var(--text-sm)] whitespace-nowrap">
              {selectedIds.size} candidate{selectedIds.size === 1 ? '' : 's'} selected
            </span>

            <NativeSelect
              size="sm"
              wrapperClassName="min-w-[200px]"
              value={bulkRoleId ?? ''}
              onChange={(e) => setBulkRoleId(e.target.value ? Number(e.target.value) : null)}
              aria-label="Assign a role to the selected drafts"
            >
              <option value="">Assign Role (Optional)…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>

            {showApproveBulk && (
              <Button
                size="sm"
                className="whitespace-nowrap"
                disabled={bulkApproveMutation.isPending}
                onClick={() => bulkApproveMutation.mutate()}
              >
                {bulkApproveMutation.isPending ? <Spinner /> : <CheckCircle2 />}
                {bulkApproveMutation.isPending
                  ? 'Approving…'
                  : `Approve Selected (${selectedIds.size})`}
              </Button>
            )}

            {showDiscardBulk && (
              <Button
                variant="outlineDestructive"
                size="sm"
                className="whitespace-nowrap"
                disabled={bulkDiscardMutation.isPending}
                onClick={() => bulkDiscardMutation.mutate()}
              >
                {bulkDiscardMutation.isPending ? <Spinner /> : <XCircle />}
                Discard Selected
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
