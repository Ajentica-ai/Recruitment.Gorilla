import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  AssignableUser,
  AuditLogEntry,
  AuditQuery,
  CVDraft,
  CandidateDetail,
  CandidateEvaluationReport,
  CandidateSourceOption,
  ChangePasswordPayload,
  EmailSettings,
  UpsertEmailSettings,
  CreateCandidatePayload,
  CreateUserPayload,
  DashboardData,
  DashboardKpis,
  StatusCount,
  TrendPoint,
  JobOpening,
  DuplicateCandidate,
  InterviewDetail,
  InterviewEvaluation,
  LoginPayload,
  LoginResult,
  MyInterview,
  NotificationList,
  PagedResult,
  CandidateListItem,
  ResetPasswordPayload,
  RoleAppliedOption,
  DeleteRoleResult,
  SkillOption,
  InterviewTypeOption,
  StatusOption,
  StatusChangePayload,
  StatusHistoryEntry,
  UpdateCandidatePayload,
  UpdateUserPayload,
  UpsertEvaluationPayload,
  UpsertOptionPayload,
  EvaluationRubric,
  UpsertEvaluationRubricPayload,
  UserListItem,
  Offer,
  CreateOfferPayload,
  UpdateOfferPayload,
  ReviewOfferApprovalPayload,
  OfferDecisionPayload,
  OfferMetrics,
  AnalyticsFilterParams,
  RecruitingAnalyticsSummary,
  CandidateDraft,
  DraftBatchSummary,
  DraftsFilterParams,
  PagedDraftsResult,
  UpdateCandidateDraftRequest,
  ApproveCandidateDraftRequest,
  BulkApproveDraftsRequest,
  BulkDiscardDraftsRequest,
} from '../types';

// Same-origin path, built from import.meta.env.BASE_URL ("/" locally, where the
// Vite proxy below forwards /api to the backend; "/ats/" in the container build,
// where the gateway routes /ats/api/* to this app's own backend). Yields '/api'
// or '/ats/api' — no trailing slash, matching every call site's leading-slash form.
const baseURL = `${import.meta.env.BASE_URL}api`;
// withCredentials so the httpOnly refresh-token cookie rides along on /auth/* calls.
const api = axios.create({ baseURL, withCredentials: true });

// The short-lived access token lives only in memory (not localStorage) to reduce
// XSS exposure. Session persistence across reloads comes from the httpOnly refresh
// cookie via refreshSession().
let accessToken: string | null = null;
export const getAccessToken = () => accessToken;

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Attach the in-memory access token to every request.
api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

const isAuthUrl = (url?: string) =>
  !!url && (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout'));

// Single-flight refresh so concurrent 401s trigger only one /refresh call.
let refreshPromise: Promise<LoginResult | null> | null = null;

export const refreshSession = async (): Promise<LoginResult | null> => {
  try {
    const { data } = await axios.post<LoginResult>(`${baseURL}/auth/refresh`, null, {
      withCredentials: true,
    });
    accessToken = data.token;
    return data;
  } catch {
    accessToken = null;
    return null;
  }
};

// On 401, try a single silent refresh and replay the request; otherwise go to login.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as RetriableConfig | undefined;
    const status = isAxiosError(err) ? err.response?.status : undefined;

    if (status === 401 && original && !original._retry && !isAuthUrl(original.url)) {
      original._retry = true;
      refreshPromise = refreshPromise ?? refreshSession();
      const result = await refreshPromise;
      refreshPromise = null;

      if (result) {
        original.headers.Authorization = `Bearer ${result.token}`;
        return api(original);
      }
      const loginPath = `${import.meta.env.BASE_URL}login`;
      if (window.location.pathname !== loginPath) {
        window.location.assign(loginPath);
      }
    }
    return Promise.reject(err);
  }
);

export const login = async (payload: LoginPayload): Promise<LoginResult> => {
  const { data } = await api.post<LoginResult>('/auth/login', payload);
  accessToken = data.token;
  return data;
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
  } catch {
    // ignore network errors on logout
  }
  accessToken = null;
};

export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await api.post('/auth/change-password', payload);
};

// ----- User management (SuperAdmin only) -----
export const getUsers = async (): Promise<UserListItem[]> => {
  const { data } = await api.get<UserListItem[]>('/users');
  return data;
};

export const createUser = async (payload: CreateUserPayload): Promise<UserListItem> => {
  const { data } = await api.post<UserListItem>('/users', payload);
  return data;
};

export const updateUser = async (id: number, payload: UpdateUserPayload): Promise<UserListItem> => {
  const { data } = await api.put<UserListItem>(`/users/${id}`, payload);
  return data;
};

export const resetUserPassword = async (id: number, payload: ResetPasswordPayload): Promise<void> => {
  await api.post(`/users/${id}/reset-password`, payload);
};

/**
 * Downloads a candidate's stored CV file with the auth token attached, then
 * triggers a browser save/open. (A plain <a href> can't send the bearer token.)
 */
export const downloadCvFile = async (candidateId: number, fileId: number): Promise<void> => {
  const res = await api.get(`/candidates/${candidateId}/cv/${fileId}`, { responseType: 'blob' });

  let filename = 'cv';
  const cd = res.headers['content-disposition'] as string | undefined;
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    if (m) filename = decodeURIComponent(m[1]);
  }

  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export type CreateCandidateResult =
  | { kind: 'created'; candidate: CandidateDetail }
  | { kind: 'duplicate'; duplicate: DuplicateCandidate };

export const uploadCV = async (
  file: File,
  batchId?: string,
  fileIndex?: number,
  totalFiles?: number,
  batchName?: string,
  roleAppliedOptionId?: number
): Promise<CVDraft> => {
  const form = new FormData();
  form.append('file', file);
  if (batchId) form.append('batchId', batchId);
  if (batchName) form.append('batchName', batchName);
  if (roleAppliedOptionId != null) form.append('roleAppliedOptionId', roleAppliedOptionId.toString());
  if (fileIndex != null) form.append('fileIndex', fileIndex.toString());
  if (totalFiles != null) form.append('totalFiles', totalFiles.toString());
  const { data } = await api.post<CVDraft>('/cvupload', form);
  return data;
};

// Candidate Drafts Staging & Review API
export const getCandidateDrafts = async (params?: DraftsFilterParams): Promise<PagedDraftsResult> => {
  const { data } = await api.get<PagedDraftsResult>('/candidate-drafts', { params });
  return data;
};

export const getCandidateDraft = async (id: number): Promise<CandidateDraft> => {
  const { data } = await api.get<CandidateDraft>(`/candidate-drafts/${id}`);
  return data;
};

export const getDraftBatches = async (): Promise<DraftBatchSummary[]> => {
  const { data } = await api.get<DraftBatchSummary[]>('/candidate-drafts/batches');
  return data;
};

export const updateCandidateDraft = async (
  id: number,
  payload: UpdateCandidateDraftRequest
): Promise<CandidateDraft> => {
  const { data } = await api.put<CandidateDraft>(`/candidate-drafts/${id}`, payload);
  return data;
};

export const approveCandidateDraft = async (
  id: number,
  payload: ApproveCandidateDraftRequest
): Promise<{ candidateId: number; message: string }> => {
  const { data } = await api.post<{ candidateId: number; message: string }>(
    `/candidate-drafts/${id}/approve`,
    payload
  );
  return data;
};

export const bulkApproveCandidateDrafts = async (
  payload: BulkApproveDraftsRequest
): Promise<{ approvedCount: number; candidateIds: number[] }> => {
  const { data } = await api.post<{ approvedCount: number; candidateIds: number[] }>(
    '/candidate-drafts/bulk-approve',
    payload
  );
  return data;
};

export const discardCandidateDraft = async (id: number): Promise<{ message: string }> => {
  const { data } = await api.post<{ message: string }>(`/candidate-drafts/${id}/discard`);
  return data;
};

export const bulkDiscardCandidateDrafts = async (
  payload: BulkDiscardDraftsRequest
): Promise<{ discardedCount: number }> => {
  const { data } = await api.post<{ discardedCount: number }>(
    '/candidate-drafts/bulk-discard',
    payload
  );
  return data;
};

// Org-wide dashboard figures (all roles, no owner scope).
export const getDashboardKpis = async (): Promise<DashboardKpis> => {
  const { data } = await api.get<DashboardKpis>('/dashboard/kpis');
  return data;
};

export const getStatusBreakdown = async (): Promise<StatusCount[]> => {
  const { data } = await api.get<StatusCount[]>('/dashboard/status-breakdown');
  return data;
};

export const getApplicationsTrend = async (days = 30): Promise<TrendPoint[]> => {
  const { data } = await api.get<TrendPoint[]>('/dashboard/applications-trend', { params: { days } });
  return data;
};

export const getJobOpenings = async (): Promise<JobOpening[]> => {
  const { data } = await api.get<JobOpening[]>('/dashboard/job-openings');
  return data;
};

// Owner-scoped remainder (by-role / top-skills / upcoming / activity).
export const getDashboard = async (roleId?: number): Promise<DashboardData> => {
  const { data } = await api.get<DashboardData>('/dashboard', {
    params: roleId ? { roleId } : undefined,
  });
  return data;
};

export const getCandidates = async (
  params: {
    search?: string;
    status?: string;
    roleId?: number;
    skillIds?: string; // CSV of skill-option ids
    referred?: boolean;
    /** Dashboard pipeline bucket: recommended | rejected | in-process | new-this-week. */
    bucket?: string;
    sort?: string; // name | status | added
    dir?: string; // asc | desc
    page?: number;
    pageSize?: number;
    batch?: string;
  }
): Promise<PagedResult<CandidateListItem>> => {
  const { data } = await api.get<PagedResult<CandidateListItem>>('/candidates', { params });
  return data;
};

export const getCandidateBatches = async (): Promise<string[]> => {
  const { data } = await api.get<string[]>('/candidates/batches');
  return data;
};

// Candidate evaluation report — all interviewers' full rubrics + aggregates (Recruiter+).
export const getCandidateEvaluationReport = async (id: number): Promise<CandidateEvaluationReport> => {
  const { data } = await api.get<CandidateEvaluationReport>(`/candidates/${id}/evaluation-report`);
  return data;
};

export const getCandidate = async (id: number): Promise<CandidateDetail> => {
  const { data } = await api.get<CandidateDetail>(`/candidates/${id}`);
  return data;
};

// ----- Audit trail (Admin+) -----
export const getAuditLog = async (query: AuditQuery): Promise<PagedResult<AuditLogEntry>> => {
  const { data } = await api.get<PagedResult<AuditLogEntry>>('/audit', { params: query });
  return data;
};

/** Distinct applied-role values already in use, for the role suggestions dropdown. */
export const getCandidateRoles = async (): Promise<string[]> => {
  const { data } = await api.get<string[]>('/candidates/roles');
  return data;
};

export const getStatusOptions = async (): Promise<StatusOption[]> => {
  const { data } = await api.get<StatusOption[]>('/status-options');
  return data;
};

export const getInitialStatusOptions = async (): Promise<StatusOption[]> => {
  const { data } = await api.get<StatusOption[]>('/status-options/initial');
  return data;
};

export const getNextStatusOptions = async (candidateId: number): Promise<StatusOption[]> => {
  const { data } = await api.get<StatusOption[]>(`/status-options/next/${candidateId}`);
  return data;
};

export const createCandidate = async (
  payload: CreateCandidatePayload
): Promise<CreateCandidateResult> => {
  try {
    const { data } = await api.post<CandidateDetail>('/candidates', payload);
    return { kind: 'created', candidate: data };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 409) {
      return { kind: 'duplicate', duplicate: err.response.data as DuplicateCandidate };
    }
    throw err;
  }
};

export const updateCandidate = async (id: number, payload: UpdateCandidatePayload): Promise<CandidateDetail> => {
  const { data } = await api.put<CandidateDetail>(`/candidates/${id}`, payload);
  return data;
};

export const addStatus = async (id: number, payload: StatusChangePayload): Promise<StatusHistoryEntry> => {
  const { data } = await api.post<StatusHistoryEntry>(`/candidates/${id}/status`, payload);
  return data;
};

export const deleteCandidate = async (id: number): Promise<void> => {
  await api.delete(`/candidates/${id}`);
};

// ----- Configuration: Role Applied options -----
// Active role/skill lookups for the candidate create/edit forms — reachable by Recruiters
// (the /config/* management endpoints are Admin+ only).
export const getActiveRoleOptions = async (): Promise<RoleAppliedOption[]> => {
  const { data } = await api.get<RoleAppliedOption[]>('/candidates/role-options');
  return data;
};

export const getActiveSkillOptions = async (): Promise<SkillOption[]> => {
  const { data } = await api.get<SkillOption[]>('/candidates/skill-options');
  return data;
};

/** Active candidate sources for the candidate forms — reachable by Recruiters, unlike /config/*. */
export const getActiveSourceOptions = async (): Promise<CandidateSourceOption[]> => {
  const { data } = await api.get<CandidateSourceOption[]>('/candidates/source-options');
  return data;
};

// Roles for the candidate-list role filter — includes inactive roles, scoped to the caller
// (Admin+ get all; a Recruiter gets their assigned roles). Distinct from getActiveRoleOptions,
// which is active-only for the create/edit form.
export const getCandidateFilterRoleOptions = async (): Promise<RoleAppliedOption[]> => {
  const { data } = await api.get<RoleAppliedOption[]>('/candidates/role-filter-options');
  return data;
};

/** All pipeline jobs/openings for view-only overview — accessible to Recruiters & Admins. */
export const getPipelineJobs = async (): Promise<RoleAppliedOption[]> => {
  const { data } = await api.get<RoleAppliedOption[]>('/candidates/jobs');
  return data;
};

export const getRoleOptions = async (includeInactive = false): Promise<RoleAppliedOption[]> => {
  const { data } = await api.get<RoleAppliedOption[]>('/config/roles', { params: { includeInactive } });
  return data;
};

/** Users who may be assigned as a job opening's recruiter (Recruiter role or higher) — a
 *  narrower list than getAssignableUsers, which answers the interviewer question. */
export const getRecruiterOptions = async (): Promise<AssignableUser[]> => {
  const { data } = await api.get<AssignableUser[]>('/config/recruiter-options');
  return data;
};

export const createRoleOption = async (payload: UpsertOptionPayload): Promise<RoleAppliedOption> => {
  const { data } = await api.post<RoleAppliedOption>('/config/roles', payload);
  return data;
};

export const updateRoleOption = async (id: number, payload: UpsertOptionPayload): Promise<RoleAppliedOption> => {
  const { data } = await api.put<RoleAppliedOption>(`/config/roles/${id}`, payload);
  return data;
};

export const deleteRoleOption = async (id: number): Promise<DeleteRoleResult> => {
  const { data } = await api.delete<DeleteRoleResult>(`/config/roles/${id}`);
  return data;
};

// ----- Configuration: Email / SMTP settings (SuperAdmin) -----
export const getEmailSettings = async (): Promise<EmailSettings> => {
  const { data } = await api.get<EmailSettings>('/config/email');
  return data;
};

export const saveEmailSettings = async (payload: UpsertEmailSettings): Promise<EmailSettings> => {
  const { data } = await api.put<EmailSettings>('/config/email', payload);
  return data;
};

export const sendTestEmail = async (toEmail: string): Promise<{ ok: boolean; error: string | null }> => {
  const { data } = await api.post<{ ok: boolean; error: string | null }>('/config/email/test', { toEmail });
  return data;
};

// ----- Configuration: Skill options -----
export const getSkillOptions = async (includeInactive = false): Promise<SkillOption[]> => {
  const { data } = await api.get<SkillOption[]>('/config/skills', { params: { includeInactive } });
  return data;
};

export const createSkillOption = async (payload: UpsertOptionPayload): Promise<SkillOption> => {
  const { data } = await api.post<SkillOption>('/config/skills', payload);
  return data;
};

export const updateSkillOption = async (id: number, payload: UpsertOptionPayload): Promise<SkillOption> => {
  const { data } = await api.put<SkillOption>(`/config/skills/${id}`, payload);
  return data;
};

export const deleteSkillOption = async (id: number): Promise<void> => {
  await api.delete(`/config/skills/${id}`);
};

// ----- Configuration: Candidate source options -----
export const getSourceOptions = async (includeInactive = false): Promise<CandidateSourceOption[]> => {
  const { data } = await api.get<CandidateSourceOption[]>('/config/sources', { params: { includeInactive } });
  return data;
};

export const createSourceOption = async (payload: UpsertOptionPayload): Promise<CandidateSourceOption> => {
  const { data } = await api.post<CandidateSourceOption>('/config/sources', payload);
  return data;
};

export const updateSourceOption = async (id: number, payload: UpsertOptionPayload): Promise<CandidateSourceOption> => {
  const { data } = await api.put<CandidateSourceOption>(`/config/sources/${id}`, payload);
  return data;
};

/** Returns the delete outcome (like roles, not skills) so the UI can report a soft-disable. */
export const deleteSourceOption = async (id: number): Promise<DeleteRoleResult> => {
  const { data } = await api.delete<DeleteRoleResult>(`/config/sources/${id}`);
  return data;
};

// ----- Configuration: Interview type options -----
export const getInterviewTypeOptions = async (includeInactive = false): Promise<InterviewTypeOption[]> => {
  const { data } = await api.get<InterviewTypeOption[]>('/config/interview-types', { params: { includeInactive } });
  return data;
};

export const createInterviewTypeOption = async (payload: UpsertOptionPayload): Promise<InterviewTypeOption> => {
  const { data } = await api.post<InterviewTypeOption>('/config/interview-types', payload);
  return data;
};

export const updateInterviewTypeOption = async (id: number, payload: UpsertOptionPayload): Promise<InterviewTypeOption> => {
  const { data } = await api.put<InterviewTypeOption>(`/config/interview-types/${id}`, payload);
  return data;
};

export const deleteInterviewTypeOption = async (id: number): Promise<void> => {
  await api.delete(`/config/interview-types/${id}`);
};

/** Active interview type tags for the schedule form (readable by any authorized user). */
export const getActiveInterviewTypes = async (): Promise<InterviewTypeOption[]> => {
  const { data } = await api.get<InterviewTypeOption[]>('/interviews/types');
  return data;
};

/**
 * Fetches a CV file (with auth) as a blob and returns an object URL + content type
 * for in-app preview. Caller must URL.revokeObjectURL(url) on cleanup.
 */
export const previewCvFile = async (
  candidateId: number,
  fileId: number
): Promise<{ url: string; contentType: string }> => {
  const res = await api.get(`/candidates/${candidateId}/cv/${fileId}`, { responseType: 'blob' });
  const blob = res.data as Blob;
  const contentType = (res.headers['content-type'] as string | undefined) ?? blob.type ?? '';
  return { url: URL.createObjectURL(blob), contentType };
};

// ----- Interviews & evaluations -----
export const getAssignableUsers = async (): Promise<AssignableUser[]> => {
  const { data } = await api.get<AssignableUser[]>('/interviews/assignable-users');
  return data;
};

export const getMyInterviews = async (): Promise<MyInterview[]> => {
  const { data } = await api.get<MyInterview[]>('/interviews/mine');
  return data;
};

export const getInterview = async (id: number): Promise<InterviewDetail> => {
  const { data } = await api.get<InterviewDetail>(`/interviews/${id}`);
  return data;
};

export const saveEvaluation = async (
  interviewId: number,
  payload: UpsertEvaluationPayload
): Promise<InterviewEvaluation> => {
  const { data } = await api.put<InterviewEvaluation>(`/interviews/${interviewId}/evaluation`, payload);
  return data;
};

// ----- Notifications -----
export const getNotifications = async (): Promise<NotificationList> => {
  const { data } = await api.get<NotificationList>('/notifications');
  return data;
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await api.post(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.post('/notifications/read-all');
};

// ----- Offers & Compensation -----
export const getCandidateOffers = async (candidateId: number): Promise<Offer[]> => {
  const { data } = await api.get<Offer[]>(`/candidates/${candidateId}/offers`);
  return data;
};

export const getOfferById = async (candidateId: number, offerId: number): Promise<Offer> => {
  const { data } = await api.get<Offer>(`/candidates/${candidateId}/offers/${offerId}`);
  return data;
};

export const createOffer = async (
  candidateId: number,
  payload: CreateOfferPayload
): Promise<Offer> => {
  const { data } = await api.post<Offer>(`/candidates/${candidateId}/offers`, payload);
  return data;
};

export const updateOffer = async (
  candidateId: number,
  offerId: number,
  payload: UpdateOfferPayload
): Promise<Offer> => {
  const { data } = await api.put<Offer>(`/candidates/${candidateId}/offers/${offerId}`, payload);
  return data;
};

export const submitOfferForApproval = async (
  candidateId: number,
  offerId: number,
  approverUserIds?: number[]
): Promise<Offer> => {
  const { data } = await api.post<Offer>(
    `/candidates/${candidateId}/offers/${offerId}/submit-approval`,
    approverUserIds ?? []
  );
  return data;
};

export const reviewOfferApproval = async (
  candidateId: number,
  offerId: number,
  payload: ReviewOfferApprovalPayload
): Promise<Offer> => {
  const { data } = await api.post<Offer>(
    `/candidates/${candidateId}/offers/${offerId}/review`,
    payload
  );
  return data;
};

export const extendOffer = async (candidateId: number, offerId: number): Promise<Offer> => {
  const { data } = await api.post<Offer>(`/candidates/${candidateId}/offers/${offerId}/extend`);
  return data;
};

export const recordOfferDecision = async (
  candidateId: number,
  offerId: number,
  payload: OfferDecisionPayload
): Promise<Offer> => {
  const { data } = await api.post<Offer>(
    `/candidates/${candidateId}/offers/${offerId}/decision`,
    payload
  );
  return data;
};

export const downloadOfferPdf = async (candidateId: number, offerId: number): Promise<Blob> => {
  const res = await api.get(`/candidates/${candidateId}/offers/${offerId}/pdf`, {
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const getOfferMetrics = async (): Promise<OfferMetrics> => {
  const { data } = await api.get<OfferMetrics>('/offers/metrics');
  return data;
};

// ----- Evaluation Rubrics -----
export const getEvaluationRubrics = async (): Promise<EvaluationRubric[]> => {
  const { data } = await api.get<EvaluationRubric[]>('/evaluation-rubrics');
  return data;
};

export const getEvaluationRubric = async (id: number): Promise<EvaluationRubric> => {
  const { data } = await api.get<EvaluationRubric>(`/evaluation-rubrics/${id}`);
  return data;
};

export const getInterviewEvaluationRubric = async (interviewId: number): Promise<EvaluationRubric> => {
  const { data } = await api.get<EvaluationRubric>(`/evaluation-rubrics/for-interview/${interviewId}`);
  return data;
};

export const createEvaluationRubric = async (
  payload: UpsertEvaluationRubricPayload
): Promise<EvaluationRubric> => {
  const { data } = await api.post<EvaluationRubric>('/evaluation-rubrics', payload);
  return data;
};

export const updateEvaluationRubric = async (
  id: number,
  payload: UpsertEvaluationRubricPayload
): Promise<EvaluationRubric> => {
  const { data } = await api.put<EvaluationRubric>(`/evaluation-rubrics/${id}`, payload);
  return data;
};

export const deleteEvaluationRubric = async (id: number): Promise<void> => {
  await api.delete(`/evaluation-rubrics/${id}`);
};

export const cloneEvaluationRubric = async (id: number): Promise<EvaluationRubric> => {
  const { data } = await api.post<EvaluationRubric>(`/evaluation-rubrics/${id}/clone`);
  return data;
};

export const setDefaultEvaluationRubric = async (id: number): Promise<void> => {
  await api.post(`/evaluation-rubrics/${id}/default`);
};

// ----- Recruiting Operational Analytics -----
export const getRecruitingAnalytics = async (
  params?: AnalyticsFilterParams
): Promise<RecruitingAnalyticsSummary> => {
  const { data } = await api.get<RecruitingAnalyticsSummary>('/analytics', { params });
  return data;
};

