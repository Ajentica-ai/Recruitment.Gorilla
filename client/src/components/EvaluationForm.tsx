import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInterviewEvaluationRubric, saveEvaluation } from '../services/api';
import { useToast } from './ToastStack';
import ConfirmModal from './common/ConfirmModal';
import SectionCard from './common/SectionCard';
import {
  ALL_CRITERION_KEYS,
  EVALUATION_SECTIONS,
  RATING_SCALE,
  RECOMMENDATIONS,
  type CriteriaSection,
  type Criterion,
} from '../utils/evaluationCriteria';
import type { EvaluationItem, EvaluationRubric, InterviewEvaluation } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';

type ItemMap = Record<string, { rating: number | null; comment: string }>;

const buildItemMap = (items: EvaluationItem[]): ItemMap => {
  const map: ItemMap = {};
  for (const it of items) map[it.criterionKey] = { rating: it.rating, comment: it.comment ?? '' };
  return map;
};

const recLabel = (value: string | null) =>
  RECOMMENDATIONS.find((r) => r.value === value)?.label ?? value ?? '—';

const ratingTitle = (n: number) => RATING_SCALE.find((r) => r.value === n)?.label ?? `${n}`;

/* Per-section icons (inline SVG, currentColor). */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  A: ( // graduation cap — background & education
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 4 2 9l10 5 10-5-10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5" />
    </svg>
  ),
  B: ( // code brackets — technical skills
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
    </svg>
  ),
  C: ( // chat bubble — soft skills & communication
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
    </svg>
  ),
  D: ( // heart — cultural fit & motivation
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" />
    </svg>
  ),
};

const DefaultSectionIcon = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`eval-panel__chevron${open ? ' eval-panel__chevron--open' : ''}`}
    viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Convert rubric criteria to sections */
const rubricToSections = (rubric?: EvaluationRubric | null): CriteriaSection[] => {
  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return EVALUATION_SECTIONS;
  }
  const map = new Map<string, Criterion[]>();
  for (const c of rubric.criteria) {
    const sec = c.sectionName || 'General';
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec)!.push({
      key: c.key,
      label: c.label,
      hint: c.hint || '',
    });
  }
  return Array.from(map.entries()).map(([title, criteria], idx) => ({
    id: String.fromCharCode(65 + (idx % 26)),
    title,
    description: `Evaluation criteria for ${title}`,
    criteria,
  }));
};

/** Section stats from the current item map: rated count + average. */
const sectionStats = (section: CriteriaSection, itemMap: ItemMap) => {
  const ratings = section.criteria
    .map((c) => itemMap[c.key]?.rating)
    .filter((r): r is number => r != null);
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  return { rated: ratings.length, total: section.criteria.length, avg };
};

const RatingDots = ({ rating }: { rating: number | null }) => (
  <span className="rating-dots" title={rating != null ? ratingTitle(rating) : 'Not rated'}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={`rating-dot${rating != null && n <= rating ? ' rating-dot--filled' : ''}`} />
    ))}
    <span className="ml-1 text-[length:var(--text-sm)] text-muted-foreground">{rating ?? '—'}</span>
  </span>
);

/** Read-only rendering of a submitted (or other interviewer's) evaluation. */
export function EvaluationReadOnly({
  evaluation,
  rubric,
}: {
  evaluation: InterviewEvaluation;
  rubric?: EvaluationRubric | null;
}) {
  const itemMap = buildItemMap(evaluation.items);
  const sections = useMemo(() => rubricToSections(rubric), [rubric]);

  return (
    <div>
      {sections.map((section) => (
        <div key={section.id} className={`eval-panel eval-panel--${section.id.toLowerCase()}`}>
          <div className="eval-panel__header">
            <span className="eval-panel__icon">{SECTION_ICONS[section.id] || DefaultSectionIcon}</span>
            <span className="eval-panel__title">{section.title}</span>
          </div>
          <div className="eval-panel__body pt-0">
            {section.criteria.map((c) => {
              const v = itemMap[c.key];
              return (
                <div key={c.key} className="eval-criterion">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    <RatingDots rating={v?.rating ?? null} />
                  </div>
                  {v?.comment && <div className="text-muted-foreground text-[length:var(--text-sm)] readonly-value mt-1">{v.comment}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mt-4">
        {evaluation.generalAssessment && (
          <div className="mb-2">
            <div className="text-muted-foreground text-[length:var(--text-sm)]">General assessment</div>
            <div className="readonly-value">{evaluation.generalAssessment}</div>
          </div>
        )}
        <div className="mb-2">
          <div className="text-muted-foreground text-[length:var(--text-sm)]">Final recommendation</div>
          <div>
            {recLabel(evaluation.recommendation)}
            {evaluation.recommendation === 'Other' && evaluation.recommendationOther
              ? `: ${evaluation.recommendationOther}`
              : ''}
          </div>
        </div>
        <div className="mb-2">
          <div className="text-muted-foreground text-[length:var(--text-sm)]">Overall rating</div>
          <RatingDots rating={evaluation.overallRating} />
        </div>
        {evaluation.isSubmitted && evaluation.submittedAt && (
          <p className="text-muted-foreground text-[length:var(--text-sm)] mb-0">
            Submitted {new Date(evaluation.submittedAt).toLocaleString()} by {evaluation.interviewerName}
          </p>
        )}
      </div>
    </div>
  );
}

/** Editable evaluation form for the assigned interviewer; locks once submitted. */
export default function EvaluationForm({
  interviewId,
  evaluation,
  briefing,
}: {
  interviewId: number;
  evaluation: InterviewEvaluation | null;
  /**
   * Pre-interview briefing notes injected between the card header and the form.
   * Rendered here so it scrolls with the form, keeping the action buttons docked.
   */
  briefing?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const { data: rubric } = useQuery({
    queryKey: ['interview-rubric', interviewId],
    queryFn: () => getInterviewEvaluationRubric(interviewId),
  });

  const sections = useMemo(() => rubricToSections(rubric), [rubric]);

  const allCriterionKeys = useMemo(
    () => sections.flatMap((s) => s.criteria.map((c) => c.key)),
    [sections]
  );

  const [items, setItems] = useState<ItemMap>(buildItemMap(evaluation?.items ?? []));
  const [generalAssessment, setGeneralAssessment] = useState(evaluation?.generalAssessment ?? '');
  const [recommendation, setRecommendation] = useState(evaluation?.recommendation ?? '');
  const [recommendationOther, setRecommendationOther] = useState(evaluation?.recommendationOther ?? '');
  const [overallRating, setOverallRating] = useState<string>(evaluation?.overallRating?.toString() ?? '');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  const submitted = evaluation?.isSubmitted ?? false;

  const payload = useMemo(
    () => ({
      generalAssessment: generalAssessment.trim() || null,
      recommendation: recommendation || null,
      recommendationOther: recommendation === 'Other' ? recommendationOther.trim() || null : null,
      overallRating: overallRating ? Number(overallRating) : null,
      items: Object.entries(items).map(([criterionKey, v]) => ({
        criterionKey,
        rating: v.rating,
        comment: v.comment.trim() || null,
      })),
    }),
    [generalAssessment, recommendation, recommendationOther, overallRating, items]
  );

  const mutation = useMutation({
    mutationFn: (submit: boolean) => saveEvaluation(interviewId, { ...payload, submit }),
    onSuccess: (_data, submit) => {
      void queryClient.invalidateQueries({ queryKey: ['interview', interviewId] });
      void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
      addToast(submit ? 'Evaluation submitted.' : 'Draft saved.');
      setConfirmSubmit(false);
    },
    onError: () => addToast('Could not save the evaluation.', 'danger'),
  });

  if (submitted && evaluation) {
    return (
      <SectionCard
        title="Your evaluation"
        actions={
          <div className="flex items-center gap-2">
            {rubric && (
              <Badge variant="neutral">Rubric: {rubric.name}</Badge>
            )}
            <Badge variant="success">Submitted</Badge>
          </div>
        }
      >
        {briefing}
        <EvaluationReadOnly evaluation={evaluation} rubric={rubric} />
      </SectionCard>
    );
  }

  const setItem = (key: string, patch: Partial<{ rating: number | null; comment: string }>) =>
    setItems((prev) => ({
      ...prev,
      [key]: { rating: prev[key]?.rating ?? null, comment: prev[key]?.comment ?? '', ...patch },
    }));

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  const totalCriteriaCount = allCriterionKeys.length || ALL_CRITERION_KEYS.length;
  const ratedCount = allCriterionKeys.filter((k) => items[k]?.rating != null).length;
  const allRated = ratedCount === totalCriteriaCount;
  const otherMissing = recommendation === 'Other' && !recommendationOther.trim();
  const recommendationMissing = !recommendation;
  const overallMissing = !overallRating;

  const onSubmitClick = () => {
    if (!allRated) {
      setShowErrors(true);
      addToast(`Please rate all ${totalCriteriaCount} evaluation criteria before submitting.`, 'danger');
      return;
    }
    if (recommendationMissing) {
      setShowErrors(true);
      addToast('Please select a final recommendation.', 'danger');
      return;
    }
    if (otherMissing) {
      setShowErrors(true);
      addToast('Please specify the recommendation for "Other".', 'danger');
      return;
    }
    if (overallMissing) {
      setShowErrors(true);
      addToast('Please select an overall rating.', 'danger');
      return;
    }
    setConfirmSubmit(true);
  };

  return (
    <SectionCard
      className="eval-form-card"
      title="Interview evaluation"
      actions={
        <div className="flex items-center gap-2">
          {rubric && (
            <Badge variant="neutral" title={rubric.description || undefined}>
              {rubric.name}
            </Badge>
          )}
          <span className={`eval-progress__count${showErrors && !allRated ? ' eval-progress__count--invalid' : ''}`}>
            Rated {ratedCount} of {totalCriteriaCount}
            <span className="required-star" aria-hidden="true">*</span>
          </span>
        </div>
      }
    >
      {briefing}

      <div
        className="eval-progress__bar"
        role="progressbar"
        aria-label="Criteria rated"
        aria-valuenow={ratedCount}
        aria-valuemin={0}
        aria-valuemax={totalCriteriaCount}
      >
        <div
          className="eval-progress__fill"
          style={{ width: `${totalCriteriaCount > 0 ? (ratedCount / totalCriteriaCount) * 100 : 0}%` }}
        />
      </div>

      <div className="eval-form-card__scroll">
        {sections.map((section) => {
          const open = openSections[section.id] ?? true;
          const stats = sectionStats(section, items);
          return (
            <div key={section.id} className={`eval-panel eval-panel--${section.id.toLowerCase()}`}>
              <button
                type="button"
                className="eval-panel__header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={open}
                aria-controls={`eval-body-${section.id}`}
              >
                <span className="eval-panel__icon">{SECTION_ICONS[section.id] || DefaultSectionIcon}</span>
                <span className="eval-panel__titles">
                  <span className="eval-panel__title block">{section.title}</span>
                  <span className="eval-panel__hint">{section.description}</span>
                </span>
                <span className="eval-panel__meta">
                  <span className="eval-panel__count">
                    {stats.rated}/{stats.total} rated{stats.avg != null ? ` · avg ${stats.avg.toFixed(1)}` : ''}
                  </span>
                  <ChevronIcon open={open} />
                </span>
              </button>
              {open && (
                <div id={`eval-body-${section.id}`}>
                  <div className="eval-panel__body">
                    {section.criteria.map((c) => {
                      const v = items[c.key];
                      return (
                        <div key={c.key} className="eval-criterion">
                          <div className="eval-criterion__head">
                            <div className="eval-criterion__label">
                              <div className="eval-criterion__name">{c.label}</div>
                              {c.hint && <div className="eval-criterion__hint">{c.hint}</div>}
                            </div>
                            <div
                              className={`rating-group${showErrors && v?.rating == null ? ' rating-group--invalid' : ''}`}
                              role="radiogroup"
                              aria-label={`Rating for ${c.label}`}
                            >
                              {RATING_SCALE.map((r) => {
                                const selected = v?.rating === r.value;
                                return (
                                  <button
                                    key={r.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    title={r.label}
                                    className={`rating-btn${selected ? ' rating-btn--active' : ''}`}
                                    onClick={() =>
                                      setItem(c.key, { rating: selected ? null : r.value })
                                    }
                                  >
                                    <span className="rating-btn__val">{r.value}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <Input
                            className="h-[var(--control-h-sm)] text-[length:var(--text-sm)] mt-2 eval-criterion__comment"
                            placeholder="Optional notes or examples…"
                            value={v?.comment ?? ''}
                            onChange={(e) => setItem(c.key, { comment: e.target.value })}
                            maxLength={500}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="eval-summary">
          <h4 className="eval-summary__title">Overall evaluation</h4>

          <div className="mb-4">
            <Label htmlFor="eval-general">General assessment</Label>
            <Textarea
              id="eval-general"
              rows={3}
              placeholder="Summary of the interview, candidate's key strengths and concerns…"
              value={generalAssessment}
              onChange={(e) => setGeneralAssessment(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-12 md:col-span-6">
              <Label htmlFor="eval-rec">
                Final recommendation <span className="required-star" aria-hidden="true">*</span>
              </Label>
              <NativeSelect
                id="eval-rec"
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                aria-invalid={showErrors && recommendationMissing || undefined}
              >
                <option value="">Select a recommendation…</option>
                {RECOMMENDATIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
              {showErrors && recommendationMissing && (
                <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">Recommendation is required to submit.</p>
              )}
            </div>

            <div className="col-span-12 md:col-span-6">
              <Label htmlFor="eval-overall">
                Overall rating <span className="required-star" aria-hidden="true">*</span>
              </Label>
              <NativeSelect
                id="eval-overall"
                value={overallRating}
                onChange={(e) => setOverallRating(e.target.value)}
                aria-invalid={showErrors && overallMissing || undefined}
              >
                <option value="">Select an overall rating…</option>
                {RATING_SCALE.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.value} — {r.label}
                  </option>
                ))}
              </NativeSelect>
              {showErrors && overallMissing && (
                <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">Overall rating is required to submit.</p>
              )}
            </div>

            {recommendation === 'Other' && (
              <div className="col-span-12">
                <Label htmlFor="eval-rec-other">
                  Please specify <span className="required-star" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="eval-rec-other"
                  value={recommendationOther}
                  onChange={(e) => setRecommendationOther(e.target.value)}
                  placeholder="e.g., Hold for senior position, Consider for different team…"
                  aria-invalid={showErrors && otherMissing || undefined}
                  maxLength={100}
                />
                {showErrors && otherMissing && (
                  <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">Please specify the recommendation.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="eval-form-actions">
        <div className="eval-form-actions__hint">
          {allRated ? (
            <span className="text-success-foreground text-[length:var(--text-sm)]">All criteria rated — ready to submit.</span>
          ) : (
            <span className="text-muted-foreground text-[length:var(--text-sm)]">
              {totalCriteriaCount - ratedCount} criteria left to rate before submitting.
            </span>
          )}
        </div>
        <div className="eval-form-actions__buttons">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(false)}
          >
            Save draft
          </Button>
          <Button
 
            disabled={mutation.isPending}
            onClick={onSubmitClick}
            >
            Submit evaluation
          </Button>
        </div>
      </div>

      <ConfirmModal
        show={confirmSubmit}
        title="Submit evaluation?"
        confirmLabel="Yes, submit"
        confirmVariant="default"
        onConfirm={() => mutation.mutate(true)}
        onCancel={() => setConfirmSubmit(false)}
        pending={mutation.isPending}
      >
        Once submitted, your evaluation is locked and cannot be edited. Are you ready to submit?
      </ConfirmModal>
    </SectionCard>
  );
}
