import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getEvaluationShareOptions } from '../services/api';

/**
 * "Share earlier rounds' evaluations with this panel" on the booking forms (#187). It appears only
 * when the candidate has an earlier interview with a submitted evaluation, because otherwise there is
 * nothing to share, and it is unchecked by default: the panel not seeing earlier verdicts first is the
 * norm, and the recruiter opts in. The count comes from the share-options query the share drawer also
 * uses, so both read one cache entry.
 */
export default function ShareEarlierRoundsField({
  candidateId,
  enabled,
  checked,
  onChange,
  id = 'share-earlier-rounds',
}: {
  candidateId: number;
  /** Only fetch while the form is open and the field could matter. */
  enabled: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const { data } = useQuery({
    queryKey: ['evaluation-share-options', candidateId],
    queryFn: () => getEvaluationShareOptions(candidateId),
    enabled,
  });

  if (!data || data.earlierRoundsWithEvaluations <= 0) return null;

  return (
    <div className="col-span-12 md:col-span-12">
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(c) => onChange(c === true)}
          className="mt-1"
        />
        <Label htmlFor={id} className="flex flex-col items-start text-left font-normal">
          <span className="font-medium">Share earlier rounds' evaluations with this panel</span>
          <span className="text-[length:var(--text-sm)] text-muted-foreground">
            The panel can read the submitted evaluations from earlier rounds. Leave it off to keep them
            from being influenced by earlier verdicts.
          </span>
        </Label>
      </div>
    </div>
  );
}
