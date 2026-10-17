import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchableMultiSelect } from './SearchableSelect';
import { useToast } from './ToastStack';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getActiveInterviewTypes,
  getAssignableUsers,
  getInterviewSchedule,
  rescheduleInterview,
} from '../services/api';
import { DURATION_OPTIONS } from '@/lib/interviewOptions';

const Req = () => (
  <span className="text-[var(--danger-text)]" aria-hidden="true">
    *
  </span>
);

interface RescheduleFieldErrors {
  scheduledAt?: string;
  interviewers?: string;
}

/** Datetime-local shape the DatePicker expects, from the ISO string the API returns. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export interface RescheduleInterviewModalProps {
  interviewId: number;
  candidateId: number;
  candidateName?: string;
  show: boolean;
  onHide: () => void;
  onRescheduled?: () => void;
}

/**
 * Moves a booked interview. Deliberately NOT a second mode of AddStatusModal: that modal's whole
 * contract is "choose the candidate's next status", with the status dropdown and the
 * requiresComment / requiresTaskDetails / requiresSubmissionUrl rules that hang off it. An
 * interview edit shares four fields and none of that logic.
 */
export default function RescheduleInterviewModal({
  interviewId,
  candidateId,
  candidateName,
  show,
  onHide,
  onRescheduled,
}: RescheduleInterviewModalProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [interviewerIds, setInterviewerIds] = useState<number[]>([]);
  const [interviewTypeIds, setInterviewTypeIds] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RescheduleFieldErrors>({});

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['interview-schedule', interviewId],
    queryFn: () => getInterviewSchedule(interviewId),
    enabled: show,
  });

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: getAssignableUsers,
    enabled: show,
  });

  const { data: interviewTypes = [] } = useQuery({
    queryKey: ['interview-types', 'active'],
    queryFn: getActiveInterviewTypes,
    enabled: show,
  });

  // Prefill from the current booking once it arrives, so the form opens on what is booked today.
  useEffect(() => {
    if (!schedule) return;
    setScheduledAt(toLocalInput(schedule.scheduledAt));
    setDurationMinutes(schedule.durationMinutes);
    setInterviewerIds(schedule.interviewerUserIds);
    setInterviewTypeIds(schedule.interviewTypeOptionIds);
    setNotes(schedule.notes ?? '');
    setReason('');
    setFieldErrors({});
  }, [schedule]);

  const clearFE = (field: keyof RescheduleFieldErrors) =>
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));

  const handleHide = () => {
    setFieldErrors({});
    onHide();
  };

  const droppedDrafters = schedule
    ? schedule.interviewerUserIds.filter((id) => !interviewerIds.includes(id))
    : [];

  const mutation = useMutation({
    mutationFn: () =>
      rescheduleInterview(interviewId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        notes: notes.trim() || null,
        interviewerUserIds: interviewerIds,
        interviewTypeOptionIds: interviewTypeIds,
        reason: reason.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['interview', interviewId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-schedule', interviewId] });
      // Deliberately NOT ['status-options', 'next', candidateId]: moving a booking is not a
      // status change, so the candidate's available next statuses are unchanged. Cancelling
      // does invalidate it, because there the candidate really does move.
      addToast('Interview rescheduled. The interviewers have been notified.');
      onRescheduled?.();
      handleHide();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to reschedule the interview.';
      addToast(msg, 'danger');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: RescheduleFieldErrors = {};
    if (!scheduledAt) errs.scheduledAt = 'Interview date/time is required.';
    else if (new Date(scheduledAt).getTime() <= Date.now())
      errs.scheduledAt = 'Pick a time in the future.';
    if (interviewerIds.length === 0) errs.interviewers = 'Select at least one interviewer.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    mutation.mutate();
  };

  const blocked = schedule?.hasSubmittedEvaluation === true;

  return (
    <Sheet open={show} onOpenChange={(open) => { if (!open) { handleHide(); } }}>
      <SheetContent className="sm:w-[min(42rem,100vw)]">
        <form onSubmit={handleSubmit} noValidate className="contents">
          <SheetHeader>
            <SheetTitle>
              {candidateName ? `Reschedule interview — ${candidateName}` : 'Reschedule interview'}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <p className="form-help mb-6">
              Moves this booking. The candidate stays at Interview Scheduled, and everyone affected
              is emailed an updated calendar invite.
            </p>

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner aria-hidden="true" /> Loading the current booking…
              </div>
            )}

            {blocked && (
              <div className="alert-info-soft mb-6">
                An interviewer has already submitted an evaluation, so this interview has taken
                place. Move the candidate to Interview Completed and schedule another round instead.
              </div>
            )}

            {schedule && !blocked && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-12">
                  <Label className="mb-1">
                    Interview date/time <Req />
                  </Label>
                  <DatePicker
                    withTime
                    value={scheduledAt}
                    onChange={(v) => {
                      setScheduledAt(v);
                      clearFE('scheduledAt');
                    }}
                    aria-invalid={!!fieldErrors.scheduledAt || undefined}
                  />
                  {fieldErrors.scheduledAt ? (
                    <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">
                      {fieldErrors.scheduledAt}
                    </p>
                  ) : null}
                </div>

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
                  <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
                    Sets the end time on the updated calendar invite.
                  </p>
                </div>

                <div className="col-span-12 md:col-span-12">
                  <Label className="mb-1">Interview types</Label>
                  <SearchableMultiSelect
                    options={interviewTypes.map((t) => ({ id: t.id, name: t.name }))}
                    value={interviewTypeIds}
                    onChange={setInterviewTypeIds}
                    placeholder="Tag this interview (Technical, HR, 1st Level…)"
                    itemNoun="interview types"
                  />
                </div>

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
                    itemNoun="interviewers"
                  />
                  {fieldErrors.interviewers && (
                    <div className="text-[var(--danger-text)] text-[length:var(--text-sm)] mt-1">
                      {fieldErrors.interviewers}
                    </div>
                  )}
                  {droppedDrafters.length > 0 && (
                    <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-[var(--danger-text)] mt-1">
                      Removing an interviewer also deletes any evaluation notes they have drafted.
                    </p>
                  )}
                </div>

                <div className="col-span-12 md:col-span-12">
                  <Label className="mb-1">Notes for interviewers</Label>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
                    Shown to the assigned interviewers on the interview page.
                  </p>
                </div>

                <div className="col-span-12 md:col-span-12">
                  <Label className="mb-1">Reason for the change</Label>
                  <Textarea
                    rows={2}
                    placeholder="Optional — included in the email to the interviewers"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={handleHide}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || blocked || !schedule}>
              {mutation.isPending ? (
                <>
                  <Spinner aria-hidden="true" /> Saving…
                </>
              ) : (
                'Save new time'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
