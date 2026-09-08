import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ClipboardList, Download, FileText, History, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  deleteCandidate,
  downloadCvFile,
  getActiveRoleOptions,
  getActiveSkillOptions,
  getActiveSourceOptions,
  getCandidate,
  previewCvFile,
  updateCandidate,
} from '../services/api';
import StatusTimeline from '../components/StatusTimeline';
import ReadOnlyCandidateProfile from '../components/ReadOnlyCandidateProfile';
import AddStatusModal from '../components/AddStatusModal';
import CandidatePipelineStepper from '../components/CandidatePipelineStepper';
import { SearchableSelect, SearchableMultiSelect } from '../components/SearchableSelect';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastStack';
import Avatar from '../components/common/Avatar';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
import Page from '../components/common/Page';
import SectionCard from '../components/common/SectionCard';
import LoadingPanel from '../components/common/Loading';
import RowActions, { RowAction, RowActionSeparator } from '../components/common/RowActions';
import EvaluationReportDrawer from '../components/EvaluationReportDrawer';
import OfferCard from '../components/offers/OfferCard';
import { useAuth } from '../auth/AuthContext';
import type { CandidateDetail, UpdateCandidatePayload } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/field';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}$/i;

function Req() {
  return <span className="required-star" aria-hidden="true">*</span>;
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const candidateId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canWriteCandidates, isAdminOrAbove } = useAuth();
  const { addToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingStatus, setAddingStatus] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showReportDrawer, setShowReportDrawer] = useState(false);
  const [cvPreview, setCvPreview] = useState<{ url: string; contentType: string; fileName: string; fileId: number } | null>(null);
  const [loadingCvId, setLoadingCvId] = useState<number | null>(null);
  const cvUrlRef = useRef<string | null>(null);

  const revokeCvUrl = () => {
    if (cvUrlRef.current) {
      URL.revokeObjectURL(cvUrlRef.current);
      cvUrlRef.current = null;
    }
  };
  useEffect(() => revokeCvUrl, []);

  const openCvPreview = async (fileId: number, fileName: string) => {
    setLoadingCvId(fileId);
    try {
      revokeCvUrl();
      const { url, contentType } = await previewCvFile(candidateId, fileId);
      cvUrlRef.current = url;
      setCvPreview({ url, contentType, fileName, fileId });
    } catch {
      // preview error handled gracefully
    } finally {
      setLoadingCvId(null);
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => getCandidate(candidateId),
    enabled: Number.isFinite(candidateId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCandidate(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      navigate('/candidates');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: UpdateCandidatePayload) => updateCandidate(candidateId, updates),
    onSuccess: () => {
      addToast('Candidate details updated successfully.');
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: () => addToast('Failed to update candidate. Please check your inputs.', 'danger'),
  });

  if (isLoading) return <LoadingPanel label="Loading candidate…" />;
  if (isError || !data) {
    return (
      <EmptyState
        page
        variant="error"
        title="Couldn't load this candidate"
        description="The record may have been deleted, or the request failed."
        action={
          <Button asChild variant="outline">
            <Link to="/candidates">Back to candidates</Link>
          </Button>
        }
      />
    );
  }

  const role = data.roleApplied ?? data.appliedRole;
  const canWrite = canWriteCandidates && !data.roleClosed;

  return (
    <Page tight>
      <div className="flex flex-col gap-1.5">
        {/* Kept as a link with this exact text — e2e/smoke.spec.ts navigates by it. */}
        <Link to="/candidates" className="back-link">
          <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Back to candidates
        </Link>

        {/* The action group used to be six buttons of equal weight — CV File,
            Status history, Add status, Edit, Evaluation report and a red
            Delete candidate — so nothing on the page said what to do next, and
            the most emphatic thing on a candidate's profile was the control
            that destroys it.

            One primary (Add status: the action this page exists for), the
            rest as ghosts, and the two rare-and-irreversible ones (delete)
            behind the overflow menu. */}
        <div className="page-header candidate-hero-header">
        <div className="who-cell">
          <Avatar name={data.fullName} email={data.email} size="hero" />
          <div className="min-w-0">
            <h2 className="candidate-hero-name mb-1">{data.fullName}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={data.currentStatus} />
              {role && <span className="badge-role-pill">{role}</span>}
            </div>
          </div>
        </div>
        <div className="page-header__actions">
          {data.cvFiles.length > 0 && (
            <Button
              variant="ghost"
              className="btn-action-cv"
              disabled={loadingCvId !== null}
              onClick={() => openCvPreview(data.cvFiles[0].id, data.cvFiles[0].originalFileName)}
              title={`Preview original CV (${data.cvFiles[0].originalFileName})`}
            >
              <FileText size={15} strokeWidth={1.75} aria-hidden="true" />
              {loadingCvId !== null ? 'Loading…' : 'CV File'}
              {data.cvFiles.length > 1 && (
                <span className="count-chip">{data.cvFiles.length}</span>
              )}
            </Button>
          )}

          {/* Status History Slide-over Trigger */}
          <Button
            variant="ghost"
            className="btn-action-history"
            onClick={() => setShowHistoryDrawer(true)}
            title="View status change history & timeline"
          >
            <History size={15} strokeWidth={1.75} aria-hidden="true" />
            Status history
            {data.statusHistory.length > 0 && (
              <span className="count-chip">{data.statusHistory.length}</span>
            )}
          </Button>

          <Button
            variant="ghost"
            className="btn-action-eval"
            onClick={() => setShowReportDrawer(true)}
          >
            <ClipboardList size={15} strokeWidth={1.75} aria-hidden="true" />
            Evaluation report
          </Button>

          {canWrite && !editing && (
            <Button className="btn-action-advance" onClick={() => setAddingStatus(true)}>
              <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
              Add status
            </Button>
          )}

          {/* Edit lives in here rather than in the row. It is a mode switch for
              the whole page, not a peer of the three read-only views beside it,
              and as a fifth button it pushed the row wide enough to crowd the
              one action this page is for. */}
          {((canWrite && !editing) || isAdminOrAbove) && (
            <RowActions label={`More actions for ${data.fullName}`}>
              {canWrite && !editing && (
                <RowAction
                  icon={<Pencil size={15} strokeWidth={1.75} aria-hidden="true" />}
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </RowAction>
              )}
              {canWrite && !editing && isAdminOrAbove && <RowActionSeparator />}
              {isAdminOrAbove && (
                <RowAction
                  icon={<Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />}
                  tone="danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete candidate
                </RowAction>
              )}
            </RowActions>
          )}
        </div>
      </div>
      <CandidatePipelineStepper currentStatus={data.currentStatus} className="mt-1" />
    </div>

      {data.roleClosed && (
        <div className="alert-warning-soft">
          <strong>Job opening closed.</strong> This candidate's applied-for role ended
          {data.roleEndDate ? ` on ${new Date(data.roleEndDate).toLocaleString()}` : ''}. Profile
          edits and status changes are locked until an Admin extends the role's End Date in
          Configuration.
        </div>
      )}

      <ConfirmModal
        show={confirmDelete}
        title="Delete candidate"
        pending={deleteMutation.isPending}
        error={deleteMutation.isError ? 'Delete failed. Please try again.' : undefined}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      >
        Permanently delete <strong>{data.fullName}</strong>, along with their CV file(s) and full
        status history? This cannot be undone.
      </ConfirmModal>

      {/* Editing Mode */}
      {editing ? (
        <div className="detail-edit-column mx-auto">
          <SectionCard
            title="Edit profile"
            description="Changes are saved to the candidate record and the audit trail."
          >
            <ProfileEditor
              candidate={data}
              onSaved={() => {
                void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
                void queryClient.invalidateQueries({ queryKey: ['candidates'] });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </SectionCard>
        </div>
      ) : (
        /* Full-Width Focused Candidate Profile Stack */
        <div className="candidate-detail-container w-full">
          <div className="card-stack candidate-profile-stack w-full">
            <ReadOnlyCandidateProfile
              candidate={data}
              showCvFiles={false}
              canEdit={canWrite}
              onSave={async (updates) => {
                await updateMutation.mutateAsync(updates);
              }}
            />
            {canWrite && <OfferCard candidate={data} />}
          </div>
        </div>
      )}

      {/* The CV viewer.

          A CV is a full page of dense text, and the point of previewing it in
          the app rather than downloading it is to read it — so the viewer
          takes almost the whole window. It used to inherit the default dialog
          width (672px) with a fixed 480px frame, which showed about a third
          of a page and made downloading the faster route. */}
      {cvPreview && (
        <Dialog open onOpenChange={(open) => !open && setCvPreview(null)}>
          <DialogContent className="sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-[min(76rem,95vw)]">
            <DialogHeader className="flex-row items-center justify-between gap-3">
              <DialogTitle className="flex min-w-0 items-center gap-2">
                <FileText size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{cvPreview.fileName}</span>
              </DialogTitle>
              <Button
                size="sm"
                variant="outline"
                className="mr-6 shrink-0"
                onClick={() => void downloadCvFile(candidateId, cvPreview.fileId)}
              >
                <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                Download
              </Button>
            </DialogHeader>
            {/* p-0 so the document meets the dialog's edges — padding around a
                page of A4 is wasted reading width. */}
            <DialogBody className="flex flex-col p-0">
              {cvPreview.contentType.includes('pdf') ? (
                <iframe
                  title={`Preview of ${cvPreview.fileName}`}
                  src={cvPreview.url}
                  className="h-full min-h-0 w-full flex-1 border-0 bg-white"
                />
              ) : (
                <div className="m-auto flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
                  <FileText size={36} strokeWidth={1.5} aria-hidden="true" />
                  <p>In-app preview isn't available for this file type.</p>
                  <Button
                    size="sm"
                    onClick={() => void downloadCvFile(candidateId, cvPreview.fileId)}
                  >
                    <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                    Download file
                  </Button>
                </div>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      <EvaluationReportDrawer
        candidateId={candidateId}
        candidateName={data.fullName}
        role={role}
        open={showReportDrawer}
        onOpenChange={setShowReportDrawer}
      />

      {/* Status History Slide-over Offcanvas Drawer */}
      <Sheet open={showHistoryDrawer} onOpenChange={setShowHistoryDrawer}>
        <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 h6 mb-0">
            <History size={18} className="text-brand" />
            <span className="font-semibold">Status History &amp; Timeline</span>
            <span className="badge bg-secondary-subtle text-text-soft px-2 py-0.5 rounded-full" style={{ fontSize: '11px' }}>
              {data.statusHistory.length} events
            </span>
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="p-6 flex flex-col gap-4">
          {canWrite && (
            <div className="p-4 rounded-[var(--radius-lg)] bg-surface-muted border border-border border-subtle flex justify-between items-center">
              <div>
                <div className="text-[length:var(--text-sm)] font-semibold text-muted-foreground mb-1 uppercase" style={{ fontSize: '10.5px', letterSpacing: '0.04em' }}>
                  Current Stage
                </div>
                <StatusBadge status={data.currentStatus} />
              </div>
              <Button
                size="sm"
 
                onClick={() => {
                  setShowHistoryDrawer(false);
                  setAddingStatus(true);
                }}
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1">Advance Stage</span>
              </Button>
            </div>
          )}

          <div className="mt-1">
            <StatusTimeline history={data.statusHistory} canViewEvaluations={isAdminOrAbove} />
          </div>
        </SheetBody>
      </SheetContent>
</Sheet>

      {canWrite && (
        <AddStatusModal
          candidateId={candidateId}
          show={addingStatus}
          onHide={() => setAddingStatus(false)}
          onAdded={() => {
            setAddingStatus(false);
            void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
          }}
        />
      )}
    </Page>
  );
}

type ProfileFieldErrors = Partial<Record<'fullName' | 'email' | 'roleApplied' | 'relevantExperience' | 'referenceName' | 'referenceEmail', string>>;

function ProfileEditor({
  candidate,
  onSaved,
  onCancel,
}: {
  candidate: CandidateDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(candidate);
  const [skillIds, setSkillIds] = useState<number[]>(candidate.skillOptions.map((s) => s.id));
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});

  useEffect(() => {
    setForm(candidate);
    setSkillIds(candidate.skillOptions.map((s) => s.id));
  }, [candidate]);

  const handleCancel = () => {
    setForm(candidate);
    setSkillIds(candidate.skillOptions.map((s) => s.id));
    setFieldErrors({});
    onCancel();
  };

  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options', 'active'],
    queryFn: getActiveRoleOptions,
  });
  const { data: skillOptions = [] } = useQuery({
    queryKey: ['skill-options', 'active'],
    queryFn: getActiveSkillOptions,
  });
  const { data: sourceOptions = [] } = useQuery({
    queryKey: ['source-options', 'active'],
    queryFn: getActiveSourceOptions,
  });

  const set = (field: keyof CandidateDetail, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const clearFE = (field: keyof ProfileFieldErrors) =>
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));

  const mutation = useMutation({
    mutationFn: () =>
      updateCandidate(candidate.id, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || null,
        currentTitle: form.currentTitle || null,
        relevantExperience: form.relevantExperience.trim(),
        skills: form.skills || null,
        summary: form.summary || null,
        linkedInUrl: form.linkedInUrl || null,
        githubUrl: form.githubUrl || null,
        portfolioUrl: form.portfolioUrl || null,
        location: form.location || null,
        leetCodeUrl: form.leetCodeUrl || null,
        codeforcesUrl: form.codeforcesUrl || null,
        hackerRankUrl: form.hackerRankUrl || null,
        gitLabUrl: form.gitLabUrl || null,
        educations: form.educations || null,
        experiences: form.experiences || null,
        appliedRole: null,
        roleAppliedOptionId: form.roleAppliedOptionId,
        sourceOptionId: form.sourceOptionId,
        sourceDetail: form.sourceDetail || null,
        skillOptionIds: skillIds,
        isReferred: form.isReferred,
        referenceName: form.isReferred ? form.referenceName || null : null,
        referenceEmail: form.isReferred ? form.referenceEmail || null : null,
        referenceEmployeeId: form.isReferred ? form.referenceEmployeeId || null : null,
      }),
    onSuccess: () => {
      addToast('Profile saved successfully.');
      onSaved();
    },
    onError: () => addToast('Save failed. Please try again.', 'danger'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: ProfileFieldErrors = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!EMAIL_REGEX.test(form.email.trim())) errs.email = 'A valid email address is required.';
    if (!form.relevantExperience?.trim()) errs.relevantExperience = 'Relevant experience is required.';
    if (!form.roleAppliedOptionId) errs.roleApplied = 'Role applied for is required.';
    if (form.isReferred && !form.referenceName?.trim())
      errs.referenceName = 'Reference name is required.';
    if (form.isReferred && !EMAIL_REGEX.test((form.referenceEmail ?? '').trim()))
      errs.referenceEmail = 'A valid reference email is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset className="border-0 p-0 m-0">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <Label>Full name <Req /></Label>
          <Input
            value={form.fullName}
            onChange={(e) => { set('fullName', e.target.value); clearFE('fullName'); }}
            aria-invalid={!!fieldErrors.fullName || undefined}
          />
          {fieldErrors.fullName ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.fullName}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Email <Req /></Label>
          <Input
            value={form.email}
            onChange={(e) => { set('email', e.target.value); clearFE('email'); }}
            aria-invalid={!!fieldErrors.email || undefined}
          />
          {fieldErrors.email ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.email}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Phone</Label>
          <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Location</Label>
          <Input
            value={form.location ?? ''}
            placeholder="e.g. Dhaka, Bangladesh"
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Current title</Label>
          <Input
            value={form.currentTitle ?? ''}
            onChange={(e) => set('currentTitle', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Relevant Experience <Req /></Label>
          <Input
            value={form.relevantExperience ?? ''}
            placeholder="e.g. 3 Years"
            onChange={(e) => { set('relevantExperience', e.target.value); clearFE('relevantExperience'); }}
            aria-invalid={!!fieldErrors.relevantExperience || undefined}
          />
          {fieldErrors.relevantExperience ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.relevantExperience}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>LinkedIn URL</Label>
          <Input
            value={form.linkedInUrl ?? ''}
            onChange={(e) => set('linkedInUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>GitHub URL</Label>
          <Input
            value={form.githubUrl ?? ''}
            onChange={(e) => set('githubUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>GitLab URL</Label>
          <Input
            value={form.gitLabUrl ?? ''}
            onChange={(e) => set('gitLabUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>LeetCode Profile</Label>
          <Input
            value={form.leetCodeUrl ?? ''}
            placeholder="https://leetcode.com/u/..."
            onChange={(e) => set('leetCodeUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Codeforces Profile</Label>
          <Input
            value={form.codeforcesUrl ?? ''}
            placeholder="https://codeforces.com/profile/..."
            onChange={(e) => set('codeforcesUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>HackerRank Profile</Label>
          <Input
            value={form.hackerRankUrl ?? ''}
            placeholder="https://hackerrank.com/profile/..."
            onChange={(e) => set('hackerRankUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Portfolio website</Label>
          <Input
            value={form.portfolioUrl ?? ''}
            onChange={(e) => set('portfolioUrl', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Role applied for <Req /></Label>
          <SearchableSelect
            options={roleOptions}
            value={form.roleAppliedOptionId}
            onChange={(roleAppliedOptionId) => { setForm((f) => ({ ...f, roleAppliedOptionId })); clearFE('roleApplied'); }}
            placeholder="Search roles…"
            aria-invalid={!!fieldErrors.roleApplied || undefined}
          />
          {fieldErrors.roleApplied && (
            <div className="invalid-feedback block">{fieldErrors.roleApplied}</div>
          )}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Source</Label>
          <SearchableSelect
            options={sourceOptions}
            value={form.sourceOptionId}
            onChange={(sourceOptionId) => setForm((f) => ({ ...f, sourceOptionId }))}
            placeholder="Where did this candidate come from?"
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Source detail</Label>
          <Input
            value={form.sourceDetail ?? ''}
            onChange={(e) => set('sourceDetail', e.target.value)}
            placeholder="Agency, campaign or board name"
          />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Skills</Label>
          <SearchableMultiSelect
            options={skillOptions}
            value={skillIds}
            onChange={setSkillIds}
            placeholder="Search skills…"
          />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Skills summary (from CV)</Label>
          <Textarea
            rows={2}
            value={form.skills ?? ''}
            onChange={(e) => set('skills', e.target.value)}
          />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Summary</Label>
          <Textarea
            rows={3}
            value={form.summary ?? ''}
            onChange={(e) => set('summary', e.target.value)}
          />
        </div>

        <div className="col-span-12 md:col-span-12">
          <hr className="mb-2" />
          <CheckboxField id="is-referred-edit" label="This candidate has been referred" checked={form.isReferred} onCheckedChange={(checked) => setForm((f) => ({ ...f, isReferred: checked }))} />
        </div>
        {form.isReferred && (
          <>
            <div className="col-span-12 md:col-span-6">
              <Label>Reference name <Req /></Label>
              <Input
                value={form.referenceName ?? ''}
                onChange={(e) => { set('referenceName', e.target.value); clearFE('referenceName'); }}
                aria-invalid={!!fieldErrors.referenceName || undefined}
              />
              {fieldErrors.referenceName ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.referenceName}</p> : null}
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Reference email <Req /></Label>
              <Input
                type="email"
                value={form.referenceEmail ?? ''}
                onChange={(e) => { set('referenceEmail', e.target.value); clearFE('referenceEmail'); }}
                aria-invalid={!!fieldErrors.referenceEmail || undefined}
              />
              {fieldErrors.referenceEmail ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.referenceEmail}</p> : null}
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Employee ID</Label>
              <Input
                value={form.referenceEmployeeId ?? ''}
                onChange={(e) => set('referenceEmployeeId', e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      </fieldset>

      <div className="form-actions">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline" type="button" disabled={mutation.isPending} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

