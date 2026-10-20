import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchableMultiSelect } from './SearchableSelect';
import EvaluationSharesList from './EvaluationSharesList';
import { useToast } from './ToastStack';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioOption } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createEvaluationShares, getEvaluationShareOptions } from '../services/api';
import { endOfDayIso, formatShareDateTime, serverErrorMessage } from '@/lib/evaluationShares';
import type { CreateEvaluationSharesPayload, CreateEvaluationSharesResult } from '@/types';

export const MAX_NOTE_LENGTH = 500;

type Scope = 'all' | 'specific';

/**
 * Share a candidate's submitted interview evaluations with named people, and see who already has
 * them. Everyone shown as "Already has access" is disabled: the server would skip them anyway, so
 * offering them only invites a confusing toast. What the server skips or rejects is still reported
 * back in the server's own words, never a generic failure.
 */
export default function ShareEvaluationsDrawer({
  candidateId,
  candidateName,
  open,
  onOpenChange,
}: {
  candidateId: number;
  candidateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [granteeIds, setGranteeIds] = useState<number[]>([]);
  const [scope, setScope] = useState<Scope>('all');
  const [interviewIds, setInterviewIds] = useState<number[]>([]);
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: options, isLoading } = useQuery({
    queryKey: ['evaluation-share-options', candidateId],
    queryFn: () => getEvaluationShareOptions(candidateId),
    enabled: open,
  });

  const reset = () => {
    setGranteeIds([]);
    setScope('all');
    setInterviewIds([]);
    setExpires('');
    setNote('');
    setFormError(null);
  };

  const mutation = useMutation({
    mutationFn: (payload: CreateEvaluationSharesPayload) => createEvaluationShares(candidateId, payload),
    onSuccess: (result: CreateEvaluationSharesResult) => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-shares', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['evaluation-share-options', candidateId] });
      const people = new Set(result.shares.map((s) => s.granteeUserId)).size;
      const parts: string[] = [];
      if (people > 0) parts.push(`Shared with ${people} ${people === 1 ? 'person' : 'people'}.`);
      if (result.skipped.length > 0) {
        parts.push(`Skipped: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}`);
      }
      addToast(parts.join(' ') || 'Nothing to share.', people > 0 ? 'success' : 'warning');
      reset();
    },
    onError: (err) => {
      const message = serverErrorMessage(err, 'Failed to share the evaluations.');
      setFormError(message);
      addToast(message, 'danger');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (granteeIds.length === 0) return setFormError('Choose at least one person to share with.');
    if (scope === 'specific' && interviewIds.length === 0)
      return setFormError('Choose at least one interview, or share all rounds.');
    if (expires && new Date(endOfDayIso(expires)).getTime() <= Date.now())
      return setFormError('The expiry must be in the future.');

    mutation.mutate({
      granteeUserIds: granteeIds,
      interviewIds: scope === 'specific' ? interviewIds : [],
      expiresAt: expires ? endOfDayIso(expires) : null,
      note: note.trim() || null,
    });
  };

  const toggleInterview = (id: number, checked: boolean) =>
    setInterviewIds((ids) => (checked ? [...ids, id] : ids.filter((i) => i !== id)));

  const interviews = options?.interviews ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        className="sm:w-[min(42rem,100vw)]"
        // The sheet would otherwise focus the first field, and focusing the people list opens it
        // over the rest of the form before anyone has asked for it.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit} noValidate className="contents">
          <SheetHeader>
            <SheetTitle>Share evaluations</SheetTitle>
            <SheetDescription>
              {candidateName}. Only submitted evaluations are shared, never drafts.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4" aria-label="Share with more people">
                <div>
                  <Label htmlFor="share-people" className="mb-1">
                    People
                  </Label>
                  <SearchableMultiSelect
                    id="share-people"
                    options={(options?.users ?? []).map((u) => ({
                      id: u.userId,
                      name: u.name,
                      subtitle: u.alreadyHasAccess ? 'Already has access' : u.email,
                      disabled: u.alreadyHasAccess,
                    }))}
                    value={granteeIds}
                    onChange={(ids) => {
                      setGranteeIds(ids);
                      setFormError(null);
                    }}
                    placeholder={isLoading ? 'Loading people…' : 'Search people…'}
                    itemNoun="people"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[length:var(--text-sm)] font-medium">What to share</p>
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)}>
                    <RadioOption value="all" id="share-scope-all">
                      All rounds (including future ones)
                    </RadioOption>
                    <RadioOption value="specific" id="share-scope-specific">
                      Specific interviews
                    </RadioOption>
                  </RadioGroup>

                  {scope === 'specific' && (
                    <ul className="mt-3 flex flex-col gap-2" aria-label="Interviews to share">
                      {interviews.length === 0 && (
                        <li className="form-help">This candidate has no interviews that can be shared yet.</li>
                      )}
                      {interviews.map((i) => {
                        const id = `share-interview-${i.interviewId}`;
                        return (
                          <li key={i.interviewId} className="flex items-start gap-2">
                            <Checkbox
                              id={id}
                              checked={interviewIds.includes(i.interviewId)}
                              onCheckedChange={(c) => toggleInterview(i.interviewId, c === true)}
                              className="mt-1"
                            />
                            <Label htmlFor={id} className="flex flex-col font-normal">
                              <span className="font-medium">{formatShareDateTime(i.scheduledAt)}</span>
                              <span className="text-[length:var(--text-sm)] text-muted-foreground">
                                {[i.tags.join(', '), i.panel.length ? `Panel: ${i.panel.join(', ')}` : '']
                                  .filter(Boolean)
                                  .join(' · ') || 'No tags or panel'}
                              </span>
                            </Label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <Label htmlFor="share-expires" className="mb-1">
                    Expires (optional)
                  </Label>
                  <DatePicker id="share-expires" value={expires} onChange={setExpires} />
                  <p className="form-help">Access ends at the end of that day. Leave empty for no expiry.</p>
                </div>

                <div>
                  <Label htmlFor="share-note" className="mb-1">
                    Note (optional)
                  </Label>
                  <Textarea
                    id="share-note"
                    rows={2}
                    maxLength={MAX_NOTE_LENGTH}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className="form-help">
                    {note.length}/{MAX_NOTE_LENGTH}. Included in the notification sent to each person.
                  </p>
                </div>

                {formError && (
                  <p role="alert" className="text-[length:var(--text-sm)] text-[var(--danger-text)]">
                    {formError}
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-3" aria-label="Current shares">
                <h3 className="section-title">Currently shared</h3>
                <EvaluationSharesList candidateId={candidateId} />
              </section>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Spinner aria-hidden="true" /> Sharing…
                </>
              ) : (
                'Share'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
