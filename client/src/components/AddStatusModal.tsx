import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchableMultiSelect } from './SearchableSelect';
import { useToast } from './ToastStack';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  addStatus,
  getActiveInterviewTypes,
  getAssignableUsers,
  getNextStatusOptions,
} from '../services/api';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const Req = () => (
  <span className="text-[var(--danger-text)]" aria-hidden="true">
    *
  </span>
);

interface AddStatusFieldErrors {
  status?: string;
  comment?: string;
  taskDetails?: string;
  submissionUrl?: string;
  interviewAt?: string;
  interviewers?: string;
}

export interface AddStatusModalProps {
  candidateId: number;
  candidateName?: string;
  initialStatus?: string;
  show: boolean;
  onHide: () => void;
  onAdded: () => void;
}

export default function AddStatusModal({
  candidateId,
  candidateName,
  initialStatus,
  show,
  onHide,
  onAdded,
}: AddStatusModalProps) {
  const { addToast } = useToast();
  const [status, setStatus] = useState(initialStatus || '');
  const [comment, setComment] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [interviewerIds, setInterviewerIds] = useState<number[]>([]);
  const [interviewTypeIds, setInterviewTypeIds] = useState<number[]>([]);
  const [fieldErrors, setFieldErrors] = useState<AddStatusFieldErrors>({});
  const queryClient = useQueryClient();

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['status-options', 'next', candidateId],
    queryFn: () => getNextStatusOptions(candidateId),
    enabled: show && !!candidateId,
  });

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus, show]);

  const requiresComment =
    status === 'Technical Assessment' ||
    status === 'Interview Completed' ||
    status === 'Reject' ||
    status === 'Discontinued';
  const requiresTaskDetails = status === 'Technical Assessment';
  const requiresSubmissionUrl = status === 'Submission Received' || status === 'Submission Receieved';
  const requiresInterviewAt = status === 'Interview Scheduled';
  const requiresInterviewers = status === 'Interview Scheduled';

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: getAssignableUsers,
    enabled: requiresInterviewers && show,
  });

  const { data: interviewTypes = [] } = useQuery({
    queryKey: ['interview-types', 'active'],
    queryFn: getActiveInterviewTypes,
    enabled: requiresInterviewers && show,
  });

  const clearFE = (field: keyof AddStatusFieldErrors) =>
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));

  const resetForm = () => {
    setStatus(initialStatus || '');
    setComment('');
    setTaskDetails('');
    setSubmissionUrl('');
    setInterviewAt('');
    setDurationMinutes(60);
    setInterviewerIds([]);
    setInterviewTypeIds([]);
    setFieldErrors({});
  };

  const handleHide = () => {
    resetForm();
    onHide();
  };

  const mutation = useMutation({
    mutationFn: () =>
      addStatus(candidateId, {
        status: status.trim(),
        comment: comment.trim() || null,
        taskDetails: taskDetails.trim() || null,
        submissionUrl: submissionUrl.trim() || null,
        interviewAt: interviewAt ? new Date(interviewAt).toISOString() : null,
        interviewerUserIds: requiresInterviewers ? interviewerIds : null,
        interviewTypeOptionIds: requiresInterviewers ? interviewTypeIds : null,
        interviewDurationMinutes: requiresInterviewAt ? durationMinutes : null,
      }),
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['status-options', 'next', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      addToast(`Status updated to '${status}'.`);
      onAdded();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to add status.';
      addToast(msg, 'danger');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: AddStatusFieldErrors = {};
    if (!status) errs.status = 'Status is required.';
    if (requiresComment && !comment.trim()) errs.comment = 'A comment is required.';
    if (requiresTaskDetails && !taskDetails.trim()) errs.taskDetails = 'Task details are required.';
    if (requiresSubmissionUrl && !submissionUrl.trim()) errs.submissionUrl = 'Submission link is required.';
    if (requiresInterviewAt && !interviewAt) errs.interviewAt = 'Interview date/time is required.';
    if (requiresInterviewers && interviewerIds.length === 0)
      errs.interviewers = 'Select at least one interviewer.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) { (handleHide)(); } }}>
<DialogContent className="sm:max-w-2xl">
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader>
          <DialogTitle>
            {candidateName ? `Advance Status — ${candidateName}` : 'Add a status'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="form-help mb-6">
            Moves the candidate to the next stage and records who changed it.
          </p>
          {statusOptions.length === 0 && !initialStatus && (
            <div className="alert-info-soft mb-6">
              No next status is available from the candidate&apos;s current status.
            </div>
          )}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-12">
              <Label className="mb-1">
                New status <Req />
              </Label>
              <NativeSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  clearFE('status');
                }}
                aria-invalid={!!fieldErrors.status || undefined}
              >
                <option value="">Select status</option>
                {statusOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
                {initialStatus && !statusOptions.some((o) => o.name === initialStatus) && (
                  <option value={initialStatus}>{initialStatus}</option>
                )}
              </NativeSelect>
              {fieldErrors.status ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.status}</p> : null}
            </div>

            {requiresTaskDetails && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">
                  Task details <Req />
                </Label>
                <Textarea
                  rows={2}
                  value={taskDetails}
                  onChange={(e) => {
                    setTaskDetails(e.target.value);
                    clearFE('taskDetails');
                  }}
                  aria-invalid={!!fieldErrors.taskDetails || undefined}
                />
                {fieldErrors.taskDetails ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.taskDetails}</p> : null}
              </div>
            )}

            {requiresSubmissionUrl && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">
                  Submission link <Req />
                </Label>
                <Input
                  type="url"
                  value={submissionUrl}
                  onChange={(e) => {
                    setSubmissionUrl(e.target.value);
                    clearFE('submissionUrl');
                  }}
                  aria-invalid={!!fieldErrors.submissionUrl || undefined}
                />
                {fieldErrors.submissionUrl ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.submissionUrl}</p> : null}
              </div>
            )}

            {requiresInterviewAt && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">
                  Interview date/time <Req />
                </Label>
                <DatePicker
                  withTime
                  value={interviewAt}
                  onChange={(v) => {
                    setInterviewAt(v);
                    clearFE('interviewAt');
                  }}
                  aria-invalid={!!fieldErrors.interviewAt || undefined}
                />
                {fieldErrors.interviewAt ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.interviewAt}</p> : null}
              </div>
            )}

            {requiresInterviewAt && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">Duration</Label>
                <NativeSelect
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  aria-label="Interview duration"
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Sets the end time on the calendar invite sent to interviewers.</p>
              </div>
            )}

            {requiresInterviewers && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">Interview types</Label>
                <SearchableMultiSelect
                  options={interviewTypes.map((t) => ({ id: t.id, name: t.name }))}
                  value={interviewTypeIds}
                  onChange={setInterviewTypeIds}
                  placeholder="Tag this interview (Technical, HR, 1st Level…)"
                />
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Optional tags shown on the status history and interview page.</p>
              </div>
            )}

            {requiresInterviewers && (
              <div className="col-span-12 md:col-span-12">
                <Label className="mb-1">
                  Interviewers <Req />
                </Label>
                <SearchableMultiSelect
                  options={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
                  value={interviewerIds}
                  onChange={(ids) => {
                    setInterviewerIds(ids);
                    clearFE('interviewers');
                  }}
                  placeholder="Search users to assign…"
                />
                {fieldErrors.interviewers && (
                  <div className="text-[var(--danger-text)] text-[length:var(--text-sm)] mt-1">{fieldErrors.interviewers}</div>
                )}
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Assigned users are notified and can fill the evaluation form.</p>
              </div>
            )}

            <div className="col-span-12 md:col-span-12">
              {requiresComment ? (
                <Label className="mb-1">
                  Comment <Req />
                </Label>
              ) : (
                requiresInterviewers && <Label className="mb-1">Notes for interviewers (optional)</Label>
              )}
              <Textarea
                rows={2}
                placeholder={requiresComment || requiresInterviewers ? '' : 'Comment (optional)'}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  clearFE('comment');
                }}
                aria-invalid={!!fieldErrors.comment || undefined}
              />
              {requiresInterviewers && (
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Shared with the assigned interviewers on the interview page.</p>
              )}
              {fieldErrors.comment ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.comment}</p> : null}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={handleHide}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner aria-hidden="true" /> Saving…
              </>
            ) : (
              'Save status'
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
</Dialog>
  );
}
