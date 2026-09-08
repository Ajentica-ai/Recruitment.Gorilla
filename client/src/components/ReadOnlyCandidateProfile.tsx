import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  downloadCvFile,
  getActiveRoleOptions,
  getActiveSkillOptions,
  getActiveSourceOptions,
  previewCvFile,
} from '../services/api';
import { StatusBadge } from './StatusBadge';
import { skillColorClass } from '../utils/skillColors';
import SearchableDropdown, { SearchableMultiSelect } from './SearchableSelect';
import type { CandidateDetail, UpdateCandidatePayload } from '../types';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckboxField } from '@/components/ui/field';

const formatSize = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}$/i;

/* Brand SVGs */
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.44-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.34-1.75-1.34-1.75-1.1-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z" />
  </svg>
);

const LeetCodeIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.014l5.314-5.69a1.372 1.372 0 0 0-.961-2.324zM16.4 8.7a1.38 1.38 0 0 0-1.38 1.38v6.24a1.38 1.38 0 0 0 2.76 0v-6.24A1.38 1.38 0 0 0 16.4 8.7z" />
  </svg>
);

const CodeforcesIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M4.5 7.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-3 0V9a1.5 1.5 0 0 1 1.5-1.5zm7.5-4.5a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-3 0V4.5A1.5 1.5 0 0 1 12 3zm7.5 9a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-3 0v-6a1.5 1.5 0 0 1 1.5-1.5z" />
  </svg>
);

const GitLabIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M23.6 9.61l-.03-.08L20.3 1.2a.84.84 0 0 0-1.59 0l-2.18 5.7H7.47L5.29 1.2a.84.84 0 0 0-1.59 0L.43 9.53l-.03.08a4.93 4.93 0 0 0 1.76 5.61l9.84 7.15 9.84-7.15a4.93 4.93 0 0 0 1.76-5.61z" />
  </svg>
);

const HackerRankIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M12 0a12 12 0 1 0 12 12A12.013 12.013 0 0 0 12 0zm1.72 17.52h-2.1v-4.5h-1.92v4.5h-2.1V6.48h2.1v4.32h1.92V6.48h2.1z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="btn-cv-download__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
  </svg>
);

const SUMMARY_COLLAPSE_THRESHOLD = 280;

interface ContactTileProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  href?: string;
  allowCopy?: boolean;
}

function ContactTile({ icon, label, value, href, allowCopy = false }: ContactTileProps) {
  const [copied, setCopied] = useState(false);

  const displayVal = value?.trim() || '—';

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!value?.trim()) return;
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="contact-tile profile-tile">
      <span className="contact-tile__icon">{icon}</span>
      <div className="contact-tile__content">
        <span className="contact-tile__label">{label}</span>
        <div className="contact-tile__value-row">
          {href && value?.trim() ? (
            <a href={href} className="contact-tile__link" title={value}>
              {value}
            </a>
          ) : (
            <span className={`contact-tile__text ${!value?.trim() ? 'text-muted-foreground' : ''}`} title={displayVal}>
              {displayVal}
            </span>
          )}
          {allowCopy && value?.trim() && (
            <button
              type="button"
              className={`contact-tile__copy-btn ${copied ? 'contact-tile__copy-btn--copied' : ''}`}
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              aria-label={`Copy ${label}`}
            >
              {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  candidate: CandidateDetail;
  showCvFiles?: boolean;
  className?: string;
  canEdit?: boolean;
  onSave?: (updates: UpdateCandidatePayload) => Promise<void>;
}

type EditableSection = 'none' | 'position' | 'contact' | 'links' | 'skills' | 'summary';

/**
 * Candidate profile shown on Candidate Detail page and Interview evaluation page.
 * Supports inline editing of sections when canEdit & onSave are provided.
 */
export default function ReadOnlyCandidateProfile({
  candidate,
  showCvFiles = true,
  className = '',
  canEdit = false,
  onSave,
}: Props) {
  const [preview, setPreview] = useState<{ url: string; contentType: string } | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Inline editing state
  const [editingSection, setEditingSection] = useState<EditableSection>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Local edit form state
  const [form, setForm] = useState({
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone ?? '',
    currentTitle: candidate.currentTitle ?? '',
    relevantExperience: candidate.relevantExperience,
    location: candidate.location ?? '',
    roleAppliedOptionId: candidate.roleAppliedOptionId,
    sourceOptionId: candidate.sourceOptionId,
    sourceDetail: candidate.sourceDetail ?? '',
    isReferred: candidate.isReferred,
    referenceName: candidate.referenceName ?? '',
    referenceEmail: candidate.referenceEmail ?? '',
    referenceEmployeeId: candidate.referenceEmployeeId ?? '',
    summary: candidate.summary ?? '',
    skills: candidate.skills ?? '',
    linkedInUrl: candidate.linkedInUrl ?? '',
    githubUrl: candidate.githubUrl ?? '',
    leetCodeUrl: candidate.leetCodeUrl ?? '',
    codeforcesUrl: candidate.codeforcesUrl ?? '',
    hackerRankUrl: candidate.hackerRankUrl ?? '',
    gitLabUrl: candidate.gitLabUrl ?? '',
    portfolioUrl: candidate.portfolioUrl ?? '',
  });

  const [skillIds, setSkillIds] = useState<number[]>(candidate.skillOptions.map((s) => s.id));

  // Sync state when candidate changes
  useEffect(() => {
    setForm({
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      currentTitle: candidate.currentTitle ?? '',
      relevantExperience: candidate.relevantExperience,
      location: candidate.location ?? '',
      roleAppliedOptionId: candidate.roleAppliedOptionId,
      sourceOptionId: candidate.sourceOptionId,
      sourceDetail: candidate.sourceDetail ?? '',
      isReferred: candidate.isReferred,
      referenceName: candidate.referenceName ?? '',
      referenceEmail: candidate.referenceEmail ?? '',
      referenceEmployeeId: candidate.referenceEmployeeId ?? '',
      summary: candidate.summary ?? '',
      skills: candidate.skills ?? '',
      linkedInUrl: candidate.linkedInUrl ?? '',
      githubUrl: candidate.githubUrl ?? '',
      leetCodeUrl: candidate.leetCodeUrl ?? '',
      codeforcesUrl: candidate.codeforcesUrl ?? '',
      hackerRankUrl: candidate.hackerRankUrl ?? '',
      gitLabUrl: candidate.gitLabUrl ?? '',
      portfolioUrl: candidate.portfolioUrl ?? '',
    });
    setSkillIds(candidate.skillOptions.map((s) => s.id));
  }, [candidate]);

  // Lookups for inline editors
  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options', 'active'],
    queryFn: getActiveRoleOptions,
    enabled: canEdit,
  });

  const { data: skillOptions = [] } = useQuery({
    queryKey: ['skill-options', 'active'],
    queryFn: getActiveSkillOptions,
    enabled: canEdit,
  });

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ['source-options', 'active'],
    queryFn: getActiveSourceOptions,
    enabled: canEdit,
  });

  const startEdit = (section: EditableSection) => {
    setFieldErrors({});
    setEditingSection(section);
  };

  const cancelEdit = () => {
    // Reset to current candidate values
    setForm({
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      currentTitle: candidate.currentTitle ?? '',
      relevantExperience: candidate.relevantExperience,
      location: candidate.location ?? '',
      roleAppliedOptionId: candidate.roleAppliedOptionId,
      sourceOptionId: candidate.sourceOptionId,
      sourceDetail: candidate.sourceDetail ?? '',
      isReferred: candidate.isReferred,
      referenceName: candidate.referenceName ?? '',
      referenceEmail: candidate.referenceEmail ?? '',
      referenceEmployeeId: candidate.referenceEmployeeId ?? '',
      summary: candidate.summary ?? '',
      skills: candidate.skills ?? '',
      linkedInUrl: candidate.linkedInUrl ?? '',
      githubUrl: candidate.githubUrl ?? '',
      leetCodeUrl: candidate.leetCodeUrl ?? '',
      codeforcesUrl: candidate.codeforcesUrl ?? '',
      hackerRankUrl: candidate.hackerRankUrl ?? '',
      gitLabUrl: candidate.gitLabUrl ?? '',
      portfolioUrl: candidate.portfolioUrl ?? '',
    });
    setSkillIds(candidate.skillOptions.map((s) => s.id));
    setFieldErrors({});
    setEditingSection('none');
  };

  const handleSaveSection = async () => {
    if (!onSave) return;
    const errors: Record<string, string> = {};

    if (editingSection === 'position') {
      if (!form.relevantExperience.trim()) {
        errors.relevantExperience = 'Relevant experience is required.';
      }
      if (!form.roleAppliedOptionId) {
        errors.roleApplied = 'Role applied for is required.';
      }
    } else if (editingSection === 'contact') {
      if (!form.fullName.trim()) {
        errors.fullName = 'Full name is required.';
      }
      if (!EMAIL_REGEX.test(form.email.trim())) {
        errors.email = 'A valid email is required.';
      }
      if (form.isReferred) {
        if (!form.referenceName.trim()) errors.referenceName = 'Reference name is required.';
        if (!EMAIL_REGEX.test(form.referenceEmail.trim())) errors.referenceEmail = 'Valid reference email is required.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        currentTitle: form.currentTitle.trim() || null,
        relevantExperience: form.relevantExperience.trim(),
        location: form.location.trim() || null,
        appliedRole: null,
        roleAppliedOptionId: form.roleAppliedOptionId,
        sourceOptionId: form.sourceOptionId,
        sourceDetail: form.sourceDetail.trim() || null,
        isReferred: form.isReferred,
        referenceName: form.isReferred ? form.referenceName.trim() || null : null,
        referenceEmail: form.isReferred ? form.referenceEmail.trim() || null : null,
        referenceEmployeeId: form.isReferred ? form.referenceEmployeeId.trim() || null : null,
        summary: form.summary.trim() || null,
        skills: form.skills.trim() || null,
        linkedInUrl: form.linkedInUrl.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        leetCodeUrl: form.leetCodeUrl.trim() || null,
        codeforcesUrl: form.codeforcesUrl.trim() || null,
        hackerRankUrl: form.hackerRankUrl.trim() || null,
        gitLabUrl: form.gitLabUrl.trim() || null,
        portfolioUrl: form.portfolioUrl.trim() || null,
        skillOptionIds: skillIds,
        educations: candidate.educations,
        experiences: candidate.experiences,
      });
      setEditingSection('none');
    } catch {
      // Error handled by parent toast
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = async (fileId: number, name: string) => {
    if (preview) URL.revokeObjectURL(preview.url);
    const p = await previewCvFile(candidate.id, fileId);
    setPreview(p);
    setPreviewName(name);
  };

  const hasLinks =
    candidate.linkedInUrl ||
    candidate.githubUrl ||
    candidate.portfolioUrl ||
    candidate.leetCodeUrl ||
    candidate.codeforcesUrl ||
    candidate.hackerRankUrl ||
    candidate.gitLabUrl;

  const summaryIsLong = (candidate.summary?.length ?? 0) > SUMMARY_COLLAPSE_THRESHOLD;
  const summaryCollapsed = summaryIsLong && !summaryExpanded;

  const skillsList: string[] = React.useMemo(() => {
    if (candidate.skillOptions && candidate.skillOptions.length > 0) {
      return candidate.skillOptions.map((s) => s.name);
    }
    if (candidate.skills && candidate.skills.trim()) {
      return candidate.skills
        .split(/[,•|;\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [];
  }, [candidate.skillOptions, candidate.skills]);

  return (
    <Card className={`profile-card ${className}`.trim()}>
      {/* Profile Header (Position, Role & Status) */}
      <div className="profile-header">
        <div className="flex justify-between items-start gap-4">
          <div className="grow">
            <div className="flex items-center justify-between gap-2">
              <div className="profile-field-label">Current position &amp; Role</div>
              {canEdit && editingSection !== 'position' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit('position')}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 -mt-1"
                  title="Edit position & title inline"
                >
                  <Pencil size={11} />
                  <span>Edit</span>
                </Button>
              )}
            </div>

            {editingSection === 'position' ? (
              <div className="mt-2 p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Current Title</Label>
                    <Input
                      className="h-8 text-xs bg-card"
                      value={form.currentTitle}
                      onChange={(e) => setForm((f) => ({ ...f, currentTitle: e.target.value }))}
                      placeholder="e.g. Senior Backend Engineer"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Role Applied For *</Label>
                    <SearchableDropdown<number>
                      options={roleOptions.map((r) => ({ id: r.id, name: r.name }))}
                      value={form.roleAppliedOptionId}
                      onChange={(val) => setForm((f) => ({ ...f, roleAppliedOptionId: val }))}
                      placeholder="Select target role…"
                    />
                    {fieldErrors.roleApplied && (
                      <span className="text-[11px] text-danger">{fieldErrors.roleApplied}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Relevant Experience *</Label>
                    <Input
                      className="h-8 text-xs bg-card"
                      value={form.relevantExperience}
                      onChange={(e) => setForm((f) => ({ ...f, relevantExperience: e.target.value }))}
                      placeholder="e.g. 4 Years"
                    />
                    {fieldErrors.relevantExperience && (
                      <span className="text-[11px] text-danger">{fieldErrors.relevantExperience}</span>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Location</Label>
                    <Input
                      className="h-8 text-xs bg-card"
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Dhaka, Bangladesh"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveSection} disabled={isSaving} className="h-7 text-xs">
                    {isSaving ? 'Saving…' : 'Save position'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="profile-title">{candidate.currentTitle || '—'}</div>
            )}
          </div>
          <StatusBadge status={candidate.currentStatus} />
        </div>

        {/* Brand Coding & Social Profile Badges */}
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Social &amp; Coding Profiles
            </span>
            {canEdit && editingSection !== 'links' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('links')}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Edit profile links inline"
              >
                <Pencil size={11} />
                <span>Edit links</span>
              </Button>
            )}
          </div>

          {editingSection === 'links' ? (
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-[11px] font-medium">LinkedIn URL</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.linkedInUrl}
                    onChange={(e) => setForm((f) => ({ ...f, linkedInUrl: e.target.value }))}
                    placeholder="https://linkedin.com/in/…"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">GitHub URL</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.githubUrl}
                    onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))}
                    placeholder="https://github.com/…"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">Portfolio / Website</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.portfolioUrl}
                    onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">LeetCode URL</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.leetCodeUrl}
                    onChange={(e) => setForm((f) => ({ ...f, leetCodeUrl: e.target.value }))}
                    placeholder="https://leetcode.com/…"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">Codeforces URL</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.codeforcesUrl}
                    onChange={(e) => setForm((f) => ({ ...f, codeforcesUrl: e.target.value }))}
                    placeholder="https://codeforces.com/…"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium">HackerRank URL</Label>
                  <Input
                    className="h-7 text-xs bg-card"
                    value={form.hackerRankUrl}
                    onChange={(e) => setForm((f) => ({ ...f, hackerRankUrl: e.target.value }))}
                    placeholder="https://hackerrank.com/…"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSection} disabled={isSaving} className="h-7 text-xs">
                  {isSaving ? 'Saving…' : 'Save links'}
                </Button>
              </div>
            </div>
          ) : hasLinks ? (
            <div className="profile-links flex flex-wrap gap-2">
              {candidate.linkedInUrl && (
                <a href={candidate.linkedInUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--linkedin" title="LinkedIn Profile">
                  <LinkedInIcon />
                  <span>LinkedIn</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.githubUrl && (
                <a href={candidate.githubUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--github" title="GitHub Profile">
                  <GitHubIcon />
                  <span>GitHub</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.leetCodeUrl && (
                <a href={candidate.leetCodeUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--leetcode" title="LeetCode Profile">
                  <LeetCodeIcon />
                  <span>LeetCode</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.codeforcesUrl && (
                <a href={candidate.codeforcesUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--codeforces" title="Codeforces Profile">
                  <CodeforcesIcon />
                  <span>Codeforces</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.hackerRankUrl && (
                <a href={candidate.hackerRankUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--hackerrank" title="HackerRank Profile">
                  <HackerRankIcon />
                  <span>HackerRank</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.gitLabUrl && (
                <a href={candidate.gitLabUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--gitlab" title="GitLab Profile">
                  <GitLabIcon />
                  <span>GitLab</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
              {candidate.portfolioUrl && (
                <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer" className="profile-link profile-link--portfolio" title="Portfolio Website">
                  <Globe size={14} strokeWidth={2} />
                  <span>Portfolio</span>
                  <ExternalLink size={11} className="profile-link__arrow" />
                </a>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">No online profile links added.</div>
          )}
        </div>
      </div>

      <CardContent className="flex flex-col gap-3.5 pt-[var(--card-pad)]">
        {/* Contact Details Section */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Contact &amp; Sourcing Details
            </span>
            {canEdit && editingSection !== 'contact' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('contact')}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Edit contact info inline"
              >
                <Pencil size={11} />
                <span>Edit contact</span>
              </Button>
            )}
          </div>

          {editingSection === 'contact' ? (
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Full Name *</Label>
                  <Input
                    className="h-8 text-xs bg-card"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  />
                  {fieldErrors.fullName && <span className="text-[11px] text-danger">{fieldErrors.fullName}</span>}
                </div>
                <div>
                  <Label className="text-xs font-semibold">Email *</Label>
                  <Input
                    className="h-8 text-xs bg-card"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  {fieldErrors.email && <span className="text-[11px] text-danger">{fieldErrors.email}</span>}
                </div>
                <div>
                  <Label className="text-xs font-semibold">Phone</Label>
                  <Input
                    className="h-8 text-xs bg-card"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div>
                  <Label className="text-xs font-semibold">Candidate Source</Label>
                  <SearchableDropdown<number>
                    options={sourceOptions.map((s) => ({ id: s.id, name: s.name }))}
                    value={form.sourceOptionId}
                    onChange={(val) => setForm((f) => ({ ...f, sourceOptionId: val }))}
                    placeholder="Select source…"
                    clearable
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Source Detail / Link</Label>
                  <Input
                    className="h-8 text-xs bg-card"
                    value={form.sourceDetail}
                    onChange={(e) => setForm((f) => ({ ...f, sourceDetail: e.target.value }))}
                    placeholder="e.g. BDJobs / Event name"
                  />
                </div>
              </div>

              {/* Referral details */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <CheckboxField
                  id="inline-referred-checkbox"
                  label="Referred by an employee"
                  checked={form.isReferred}
                  onCheckedChange={(checked: boolean) => setForm((f) => ({ ...f, isReferred: checked }))}
                />

                {form.isReferred && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-6 pt-1">
                    <div>
                      <Label className="text-xs font-semibold">Referrer Name *</Label>
                      <Input
                        className="h-8 text-xs bg-card"
                        value={form.referenceName}
                        onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
                      />
                      {fieldErrors.referenceName && <span className="text-[11px] text-danger">{fieldErrors.referenceName}</span>}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Referrer Email *</Label>
                      <Input
                        className="h-8 text-xs bg-card"
                        value={form.referenceEmail}
                        onChange={(e) => setForm((f) => ({ ...f, referenceEmail: e.target.value }))}
                      />
                      {fieldErrors.referenceEmail && <span className="text-[11px] text-danger">{fieldErrors.referenceEmail}</span>}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Employee ID</Label>
                      <Input
                        className="h-8 text-xs bg-card"
                        value={form.referenceEmployeeId}
                        onChange={(e) => setForm((f) => ({ ...f, referenceEmployeeId: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSection} disabled={isSaving} className="h-7 text-xs">
                  {isSaving ? 'Saving…' : 'Save contact details'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="contact-grid">
              <ContactTile
                icon={<Mail size={15} />}
                label="Email"
                value={candidate.email}
                href={`mailto:${candidate.email}`}
                allowCopy
              />
              <ContactTile
                icon={<Phone size={15} />}
                label="Phone"
                value={candidate.phone}
                href={candidate.phone ? `tel:${candidate.phone}` : undefined}
                allowCopy
              />
              <ContactTile
                icon={<MapPin size={15} />}
                label="Location"
                value={candidate.location}
              />
              <ContactTile
                icon={<Briefcase size={15} />}
                label="Relevant Experience"
                value={candidate.relevantExperience}
              />
              <ContactTile
                icon={<UserCheck size={15} />}
                label="Source"
                value={
                  candidate.source
                    ? candidate.sourceDetail
                      ? `${candidate.source} — ${candidate.sourceDetail}`
                      : candidate.source
                    : 'Direct Application'
                }
              />
              {candidate.isReferred && (
                <ContactTile
                  icon={<Users size={15} />}
                  label="Referred By"
                  value={`${candidate.referenceName || 'Employee'}${candidate.referenceEmail ? ` (${candidate.referenceEmail})` : ''}`}
                />
              )}
            </div>
          )}
        </div>

        {/* Technical Skills Section */}
        <div className="profile-section">
          <div className="flex items-center justify-between gap-2">
            <div className="profile-section__title">
              <Code2 size={15} className="profile-section__icon" />
              <span>Technical Skills</span>
              {skillsList.length > 0 && (
                <span className="profile-section__count badge bg-secondary-subtle text-text-soft">
                  {skillsList.length}
                </span>
              )}
            </div>
            {canEdit && editingSection !== 'skills' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('skills')}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Edit skills inline"
              >
                <Pencil size={11} />
                <span>Edit skills</span>
              </Button>
            )}
          </div>

          {editingSection === 'skills' ? (
            <div className="mt-2 p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div>
                <Label className="text-xs font-semibold">Configured Skills</Label>
                <SearchableMultiSelect
                  options={skillOptions}
                  value={skillIds}
                  onChange={setSkillIds}
                  placeholder="Choose skills from catalog…"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Custom / Additional Skills (free text)</Label>
                <Input
                  className="h-8 text-xs bg-card"
                  value={form.skills}
                  onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                  placeholder="e.g. React, Next.js, Docker, Microservices"
                />
                <span className="text-[11px] text-muted-foreground">Separate with commas</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSection} disabled={isSaving} className="h-7 text-xs">
                  {isSaving ? 'Saving…' : 'Save skills'}
                </Button>
              </div>
            </div>
          ) : skillsList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {skillsList.map((skillName, idx) => (
                <span key={`${skillName}-${idx}`} className={skillColorClass(skillName)}>
                  {skillName}
                </span>
              ))}
            </div>
          ) : (
            <div className="profile-empty-text">No technical skills listed.</div>
          )}
        </div>

        {/* Professional Summary Section */}
        <div className="profile-section">
          <div className="flex items-center justify-between gap-2">
            <div className="profile-section__title">
              <FileText size={15} className="profile-section__icon" />
              <span>Professional Summary</span>
            </div>
            {canEdit && editingSection !== 'summary' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit('summary')}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Edit summary inline"
              >
                <Pencil size={11} />
                <span>Edit summary</span>
              </Button>
            )}
          </div>

          {editingSection === 'summary' ? (
            <div className="mt-2 p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div>
                <Label className="text-xs font-semibold">Executive Summary / Bio</Label>
                <Textarea
                  className="text-xs bg-card min-h-[120px]"
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Candidate professional summary, strengths, and achievements…"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSection} disabled={isSaving} className="h-7 text-xs">
                  {isSaving ? 'Saving…' : 'Save summary'}
                </Button>
              </div>
            </div>
          ) : candidate.summary && candidate.summary.trim() ? (
            <div>
              <div className={`profile-summary${summaryCollapsed ? ' profile-summary--collapsed' : ''}`}>
                {candidate.summary}
              </div>
              {summaryIsLong && (
                <button
                  type="button"
                  className="profile-summary-toggle"
                  onClick={() => setSummaryExpanded((v) => !v)}
                >
                  {summaryExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          ) : (
            <div className="profile-empty-text">No professional summary provided.</div>
          )}
        </div>

        {/* Education & Academics Section */}
        <div className="profile-section">
          <div className="profile-section__title">
            <GraduationCap size={16} className="profile-section__icon" />
            <span>Education &amp; Academics</span>
            {candidate.educations && candidate.educations.length > 0 && (
              <span className="profile-section__count badge bg-secondary-subtle text-text-soft">
                {candidate.educations.length}
              </span>
            )}
          </div>
          {candidate.educations && candidate.educations.length > 0 ? (
            <div className="flex flex-col gap-2 mt-1.5">
              {candidate.educations.map((edu, idx) => (
                <div key={edu.id ?? idx} className="education-card">
                  <div className="education-card__header">
                    <div className="flex items-center gap-2 min-w-0">
                      <GraduationCap size={15} className="education-card__icon shrink-0" />
                      <span className="education-card__degree truncate">
                        {edu.degree}
                      </span>
                    </div>
                    {edu.cgpa && (
                      <span className="badge badge-cgpa shrink-0">
                        CGPA {edu.cgpa}
                      </span>
                    )}
                  </div>
                  <div className="education-card__meta">
                    <span className="education-card__institution">{edu.institution}</span>
                    {edu.graduationYear && (
                      <span className="education-card__year">{edu.graduationYear}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-text">No educational qualifications recorded.</div>
          )}
        </div>

        {/* Work & Employment History Section */}
        <div className="profile-section">
          <div className="profile-section__title">
            <Building2 size={15} className="profile-section__icon" />
            <span>Work Experience</span>
            {candidate.experiences && candidate.experiences.length > 0 && (
              <span className="profile-section__count badge bg-secondary-subtle text-text-soft">
                {candidate.experiences.length}
              </span>
            )}
          </div>
          {candidate.experiences && candidate.experiences.length > 0 ? (
            <div className="flex flex-col gap-2.5 mt-1.5">
              {candidate.experiences.map((exp, idx) => (
                <div key={exp.id ?? idx} className="experience-card">
                  <div className="experience-card__header">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={15} className="experience-card__icon shrink-0" />
                      <span className="experience-card__title truncate">
                        {exp.jobTitle}
                      </span>
                    </div>
                    {exp.duration && (
                      <span className="badge badge-duration shrink-0">
                        {exp.duration}
                      </span>
                    )}
                  </div>
                  <div className="experience-card__company">
                    {exp.company}
                  </div>
                  {exp.description && (
                    <div className="experience-card__description">
                      {exp.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-text">No prior work experience recorded.</div>
          )}
        </div>

        {/* CV Files Section */}
        {showCvFiles && candidate.cvFiles.length > 0 && (
          <div className="profile-section">
            <div className="profile-section__title">
              <FileText size={15} className="profile-section__icon" />
              <span>Original CV Files</span>
              <span className="profile-section__count badge bg-secondary-subtle text-text-soft">
                {candidate.cvFiles.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 mt-1.5">
              {candidate.cvFiles.map((f) => (
                <div key={f.id} className="cv-file-item">
                  <span className="cv-file-item__icon"><FileText size={18} /></span>
                  <span className="cv-file-item__meta">
                    <span className="cv-file-item__name truncate">{f.originalFileName}</span>
                    <span className="cv-file-item__size">{formatSize(f.fileSizeBytes)}</span>
                  </span>
                  <span className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => void openPreview(f.id, f.originalFileName)}>Preview</Button>
                    <Button size="sm" onClick={() => void downloadCvFile(candidate.id, f.id)}>
                      <DownloadIcon />
                      Download
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCvFiles && preview && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[length:var(--text-sm)] text-muted-foreground truncate">{previewName}</span>
              <Button size="sm" variant="link" className="p-0" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>Close</Button>
            </div>
            {preview.contentType.includes('pdf') ? (
              <iframe
                title="CV preview"
                src={preview.url}
                className="h-[480px] w-full rounded-[var(--radius-control)] border border-border bg-white"
              />
            ) : (
              <Alert variant="info" className="mb-0">In-app preview isn't available for this file type. Use Download.</Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
