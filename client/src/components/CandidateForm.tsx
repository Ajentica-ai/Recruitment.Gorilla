import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createCandidate,
  getInitialStatusOptions,
  getActiveRoleOptions,
  getActiveSkillOptions,
  getActiveSourceOptions,
} from '../services/api';
import { SearchableSelect, SearchableMultiSelect } from './SearchableSelect';
import { useToast } from './ToastStack';
import type { CVDraft, DuplicateCandidate } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/field';

interface Props {
  draft: CVDraft;
  onSaved: () => void;
  onCancel: () => void;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}$/i;
type FieldKey = 'fullName' | 'email' | 'roleApplied' | 'relevantExperience' | 'referenceName' | 'referenceEmail';
type FieldErrors = Partial<Record<FieldKey, string>>;

function Req() {
  return <span className="required-star" aria-hidden="true">*</span>;
}

export default function CandidateForm({ draft, onSaved, onCancel }: Props) {
  const { addToast } = useToast();
  const [fullName, setFullName] = useState(draft.fullName ?? '');
  const [email, setEmail] = useState(draft.email ?? '');
  const [phone, setPhone] = useState(draft.phone ?? '');
  const [currentTitle, setCurrentTitle] = useState(draft.currentTitle ?? '');
  const [relevantExperience, setRelevantExperience] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState(draft.linkedInUrl ?? '');
  const [githubUrl, setGithubUrl] = useState(draft.githubUrl ?? '');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [roleAppliedOptionId, setRoleAppliedOptionId] = useState<number | null>(null);
  const [sourceOptionId, setSourceOptionId] = useState<number | null>(null);
  const [sourceDetail, setSourceDetail] = useState('');
  const [skillOptionIds, setSkillOptionIds] = useState<number[]>([]);
  const [isReferred, setIsReferred] = useState(false);
  const [referenceName, setReferenceName] = useState('');
  const [referenceEmail, setReferenceEmail] = useState('');
  const [referenceEmployeeId, setReferenceEmployeeId] = useState('');
  const [skills, setSkills] = useState(draft.skills ?? '');
  const [summary, setSummary] = useState(draft.summary ?? '');
  const [initialStatus, setInitialStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateCandidate | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['status-options', 'initial'],
    queryFn: getInitialStatusOptions,
  });

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

  useEffect(() => {
    if (!initialStatus && statusOptions.length > 0) {
      setInitialStatus(statusOptions[0].name);
    }
  }, [initialStatus, statusOptions]);

  // A recruiter assigned to exactly one role gets it auto-selected; with several (or an Admin),
  // no auto-selection happens.
  useEffect(() => {
    if (roleOptions.length === 1 && roleAppliedOptionId === null) {
      setRoleAppliedOptionId(roleOptions[0].id);
    }
  }, [roleOptions, roleAppliedOptionId]);

  const clearFE = (field: FieldKey) =>
    setFieldErrors((fe) => ({ ...fe, [field]: undefined }));

  const save = async (allowDuplicate: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await createCandidate({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        currentTitle: currentTitle.trim() || null,
        relevantExperience: relevantExperience.trim(),
        skills: skills.trim() || null,
        summary: summary.trim() || null,
        linkedInUrl: linkedInUrl.trim() || null,
        githubUrl: githubUrl.trim() || null,
        portfolioUrl: portfolioUrl.trim() || null,
        appliedRole: null,
        roleAppliedOptionId,
        sourceOptionId,
        sourceDetail: sourceDetail.trim() || null,
        skillOptionIds,
        isReferred,
        referenceName: isReferred ? referenceName.trim() || null : null,
        referenceEmail: isReferred ? referenceEmail.trim() || null : null,
        referenceEmployeeId: isReferred ? referenceEmployeeId.trim() || null : null,
        storedFileName: draft.storedFileName,
        originalFileName: draft.originalFileName,
        fileType: draft.fileType,
        fileSizeBytes: draft.fileSizeBytes,
        initialStatus,
        initialStatusComment: null,
        allowDuplicate,
        location: draft.location ?? null,
        leetCodeUrl: draft.leetCodeUrl ?? null,
        codeforcesUrl: draft.codeforcesUrl ?? null,
        hackerRankUrl: draft.hackerRankUrl ?? null,
        gitLabUrl: draft.gitLabUrl ?? null,
        educations: draft.educations ?? null,
        experiences: draft.experiences ?? null,
      });

      if (result.kind === 'duplicate') {
        setDuplicate(result.duplicate);
        return;
      }
      addToast('Candidate saved successfully.');
      onSaved();
    } catch {
      setSaveError('Failed to save candidate. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required.';
    if (!EMAIL_REGEX.test(email.trim())) errs.email = 'A valid email address is required.';
    if (!relevantExperience.trim()) errs.relevantExperience = 'Relevant experience is required.';
    if (!roleAppliedOptionId) errs.roleApplied = 'Role applied for is required.';
    if (isReferred && !referenceName.trim()) errs.referenceName = 'Reference name is required.';
    if (isReferred && !EMAIL_REGEX.test(referenceEmail.trim()))
      errs.referenceEmail = 'A valid reference email is required.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    void save(false);
  };

  return (
    // The card that hosts this form owns the heading and the file name now, so
    // the form no longer prints its own <h5> above them.
    <form onSubmit={handleSubmit} noValidate>
      {saveError && (
        <div className="alert-danger-soft mb-6" role="alert">
          {saveError}
        </div>
      )}

      {duplicate && (
        <div className="alert-warning-soft mb-6">
          <div>
            {duplicate.message}{' '}
            <Link to={`/candidates/${duplicate.existing.id}`}>Open existing candidate</Link>.
          </div>
          <div className="mt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void save(true)}
            >
              Save anyway
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <Label>Full name <Req /></Label>
          <Input
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearFE('fullName'); }}
            aria-invalid={!!fieldErrors.fullName || undefined}
          />
          {fieldErrors.fullName ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.fullName}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Email <Req /></Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFE('email'); }}
            aria-invalid={!!fieldErrors.email || undefined}
          />
          {fieldErrors.email ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.email}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Current title</Label>
          <Input value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Relevant Experience <Req /></Label>
          <Input
            value={relevantExperience}
            placeholder="e.g. 3 Years"
            onChange={(e) => { setRelevantExperience(e.target.value); clearFE('relevantExperience'); }}
            aria-invalid={!!fieldErrors.relevantExperience || undefined}
          />
          {fieldErrors.relevantExperience ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.relevantExperience}</p> : null}
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>LinkedIn URL</Label>
          <Input value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>GitHub URL</Label>
          <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Portfolio website</Label>
          <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Role applied for <Req /></Label>
          <SearchableSelect
            options={roleOptions}
            value={roleAppliedOptionId}
            onChange={(v) => { setRoleAppliedOptionId(v); clearFE('roleApplied'); }}
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
            value={sourceOptionId}
            onChange={setSourceOptionId}
            placeholder="Where did this candidate come from?"
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Label>Source detail</Label>
          <Input
            value={sourceDetail}
            onChange={(e) => setSourceDetail(e.target.value)}
            placeholder="Agency, campaign or board name"
          />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Skills</Label>
          <SearchableMultiSelect
            options={skillOptions}
            value={skillOptionIds}
            onChange={setSkillOptionIds}
            placeholder="Search skills…"
          />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Skills summary (from CV)</Label>
          <Textarea rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-12">
          <Label>Summary</Label>
          <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="col-span-12 md:col-span-12">
          <div className="field-divider" />
          <CheckboxField id="is-referred" label="This candidate has been referred" checked={isReferred} onCheckedChange={(checked) => setIsReferred(checked)} />
        </div>
        {isReferred && (
          <>
            <div className="col-span-12 md:col-span-6">
              <Label>Reference name <Req /></Label>
              <Input
                value={referenceName}
                onChange={(e) => { setReferenceName(e.target.value); clearFE('referenceName'); }}
                aria-invalid={!!fieldErrors.referenceName || undefined}
              />
              {fieldErrors.referenceName ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.referenceName}</p> : null}
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Reference email <Req /></Label>
              <Input
                type="email"
                value={referenceEmail}
                onChange={(e) => { setReferenceEmail(e.target.value); clearFE('referenceEmail'); }}
                aria-invalid={!!fieldErrors.referenceEmail || undefined}
              />
              {fieldErrors.referenceEmail ? <p className="text-[length:var(--text-sm)] text-[var(--danger-text)]">{fieldErrors.referenceEmail}</p> : null}
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label>Employee ID</Label>
              <Input
                value={referenceEmployeeId}
                onChange={(e) => setReferenceEmployeeId(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="form-actions">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save candidate'}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Skip this CV
        </Button>
      </div>
    </form>
  );
}
