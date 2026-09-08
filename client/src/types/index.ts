export interface CandidateEducation {
  id?: number;
  degree: string;
  institution: string;
  graduationYear?: string | null;
  cgpa?: string | null;
}

export interface CandidateExperience {
  id?: number;
  jobTitle: string;
  company: string;
  duration?: string | null;
  description?: string | null;
}

export interface CVDraft {
  id?: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentTitle: string | null;
  skills: string | null;
  summary: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  originalFileName: string;
  storedFileName: string;
  fileType: string;
  fileSizeBytes: number;
  batchId?: string;
  batchName?: string;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface CandidateDraft {
  id: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentTitle: string | null;
  relevantExperience: string | null;
  skills: string | null;
  summary: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  roleAppliedOptionId: number | null;
  roleAppliedOptionName: string | null;
  sourceOptionId: number | null;
  sourceOptionName: string | null;
  sourceDetail: string | null;
  originalFileName: string;
  storedFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: 'Pending' | 'Approved' | 'Discarded' | string;
  batchId: string | null;
  batchName: string | null;
  uploadedByUserId: number | null;
  uploadedByUserName: string | null;
  createdAt: string;
  updatedAt: string;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface CandidateDraftListItem {
  id: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentTitle: string | null;
  relevantExperience: string | null;
  skills: string | null;
  roleAppliedOptionId: number | null;
  roleAppliedOptionName: string | null;
  originalFileName: string;
  storedFileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: 'Pending' | 'Approved' | 'Discarded' | string;
  batchId: string | null;
  batchName: string | null;
  createdAt: string;
  location?: string | null;
}

export interface UpdateCandidateDraftRequest {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  currentTitle?: string | null;
  relevantExperience?: string | null;
  skills?: string | null;
  summary?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  roleAppliedOptionId?: number | null;
  sourceOptionId?: number | null;
  sourceDetail?: string | null;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface ApproveCandidateDraftRequest {
  fullName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  relevantExperience?: string;
  skills?: string | null;
  summary?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  roleAppliedOptionId: number;
  sourceOptionId?: number | null;
  sourceDetail?: string | null;
  skillOptionIds?: number[];
  isReferred?: boolean;
  referenceName?: string | null;
  referenceEmail?: string | null;
  referenceEmployeeId?: string | null;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface BulkApproveDraftsRequest {
  draftIds: number[];
  defaultRoleAppliedOptionId?: number;
  defaultSourceOptionId?: number;
  defaultRelevantExperience?: string;
}

export interface BulkDiscardDraftsRequest {
  draftIds: number[];
}

export interface DraftBatchSummary {
  batchId: string;
  batchName: string;
  totalDrafts: number;
  pendingDrafts: number;
  approvedDrafts: number;
  discardedDrafts: number;
  createdAt: string;
}

export interface DraftsFilterParams {
  status?: string;
  batchId?: string;
  roleId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
  cursor?: number;
}

export interface PagedDraftsResult {
  items: CandidateDraftListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalPending: number;
  totalApproved: number;
  totalDiscarded: number;
  nextCursor: number | null;
}

export interface CreateCandidatePayload {
  fullName: string;
  email: string;
  phone: string | null;
  currentTitle: string | null;
  relevantExperience: string;
  skills: string | null;
  summary: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  appliedRole: string | null;
  isReferred: boolean;
  referenceName: string | null;
  referenceEmail: string | null;
  referenceEmployeeId: string | null;
  roleAppliedOptionId: number | null;
  skillOptionIds: number[];
  storedFileName: string;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  initialStatus: string;
  initialStatusComment: string | null;
  allowDuplicate?: boolean;
  sourceOptionId: number | null;
  sourceDetail: string | null;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface DuplicateCandidate {
  message: string;
  existing: CandidateListItem;
}

export interface UpdateCandidatePayload {
  fullName: string;
  email: string;
  phone: string | null;
  currentTitle: string | null;
  relevantExperience: string;
  skills: string | null;
  summary: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  appliedRole: string | null;
  isReferred: boolean;
  referenceName: string | null;
  referenceEmail: string | null;
  referenceEmployeeId: string | null;
  roleAppliedOptionId: number | null;
  skillOptionIds: number[];
  sourceOptionId?: number | null;
  sourceDetail?: string | null;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface CandidateSourceOption {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RoleAppliedOption {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  // Job-opening posting metadata
  location?: string | null;
  department?: string | null;
  priority?: string | null;
  createdAt: string;   // = posted date (read-only)
  endDate: string;     // required closing deadline
  title: string;       // computed: "{name} — {posted date}"
  recruiters: { userId: number; name: string }[];
  evaluationRubricId?: number | null;
  evaluationRubricName?: string | null;
  candidateCount?: number;
}

export interface SkillOption {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface InterviewTypeOption {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UpsertOptionPayload {
  name: string;
  sortOrder: number;
  isActive: boolean;
  // Job-opening fields — only sent for role options (skills ignore them).
  location?: string | null;
  department?: string | null;
  priority?: string | null;
  endDate?: string | null;   // required for roles
  recruiterUserIds?: number[];
  evaluationRubricId?: number | null;
}

export interface DeleteRoleResult {
  deleted: boolean;
  deactivated: boolean;
  candidateCount: number;
}

export interface StatusChangePayload {
  status: string;
  comment: string | null;
  taskDetails: string | null;
  submissionUrl: string | null;
  interviewAt: string | null;
  // Required (non-empty) when status === 'Interview Scheduled'.
  interviewerUserIds?: number[] | null;
  // Optional when status === 'Interview Scheduled': interview type tag ids.
  interviewTypeOptionIds?: number[] | null;
  // Optional when status === 'Interview Scheduled': sets the calendar invite's end time.
  interviewDurationMinutes?: number | null;
}

export interface CandidateListItem {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  currentTitle: string | null;
  appliedRole: string | null;
  currentStatus: string;
  createdAt: string;
  source: string | null;
  updatedAt?: string;
  batchName?: string | null;
}

export interface CVFileInfo {
  id: number;
  originalFileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface StatusHistoryEntry {
  id: number;
  status: string;
  comment: string | null;
  taskDetails: string | null;
  submissionUrl: string | null;
  interviewAt: string | null;
  changedAt: string;
  changedBy: string;
  interviewId: number | null;
  interviewers: { userId: number; name: string }[];
  interviewTags: string[];
  evaluationSummaries: EvaluationSummary[];
}

export interface EvaluationSummary {
  interviewerName: string;
  overallRating: number | null;
  recommendation: string | null;
  recommendationOther: string | null;
  submittedAt: string | null;
}

export interface StatusOption {
  id: number;
  name: string;
  sortOrder: number;
  isInitial: boolean;
}

export interface CandidateDetail {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  currentTitle: string | null;
  relevantExperience: string;
  skills: string | null;
  summary: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  appliedRole: string | null;
  isReferred: boolean;
  referenceName: string | null;
  referenceEmail: string | null;
  referenceEmployeeId: string | null;
  roleAppliedOptionId: number | null;
  roleApplied: string | null;
  skillOptions: SkillOption[];
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  cvFiles: CVFileInfo[];
  statusHistory: StatusHistoryEntry[];
  roleEndDate: string | null;
  roleClosed: boolean;
  sourceOptionId: number | null;
  source: string | null;
  sourceDetail: string | null;
  location?: string | null;
  leetCodeUrl?: string | null;
  codeforcesUrl?: string | null;
  hackerRankUrl?: string | null;
  gitLabUrl?: string | null;
  educations?: CandidateEducation[] | null;
  experiences?: CandidateExperience[] | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  actorUserId: number | null;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  summary: string | null;
  details: string | null;
}

export interface AuditQuery {
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type Role = 'SuperAdmin' | 'Admin' | 'Recruiter' | 'Interviewer';

export const ALL_ROLES: Role[] = ['SuperAdmin', 'Admin', 'Recruiter', 'Interviewer'];

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  name: string;
  email: string;
  roles: Role[];
  mustChangePassword: boolean;
  expiresAt: string;
}

export interface AuthUser {
  name: string;
  email: string;
  roles: Role[];
  mustChangePassword: boolean;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UserListItem {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roles: Role[];
  temporaryPassword: string;
}

export interface UpdateUserPayload {
  name: string;
  roles: Role[];
  isActive: boolean;
}

export interface ResetPasswordPayload {
  temporaryPassword: string;
}

// ----- Dashboard -----
export interface DashboardKpis {
  totalCandidates: number;
  inProcess: number;
  recommended: number;
  rejected: number;
  newThisWeek: number;
  referredCount: number;
  referredPercent: number;
}

export interface StatusCount {
  status: string;
  count: number;
  sortOrder: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface UpcomingInterview {
  candidateId: number;
  fullName: string;
  role: string | null;
  currentStatus: string;
  interviewAt: string;
}

export interface ActivityItem {
  candidateId: number;
  fullName: string;
  status: string;
  changedBy: string;
  changedAt: string;
}

export interface JobOpening {
  id: number;
  title: string;
  location: string | null;
  department: string | null;
  priority: string | null;
  postedDate: string;
  endDate: string;
  applicants: number;
}

/** Owner-scoped remainder (candidate-centric). Org-wide figures come from their own endpoints. */
export interface DashboardData {
  byRole: NameCount[];
  topSkills: NameCount[];
  upcomingInterviews: UpcomingInterview[];
  recentActivity: ActivityItem[];
}

// ----- Interviews & evaluations -----
export interface AssignableUser {
  id: number;
  name: string;
  email: string;
}

export type EvaluationState = 'None' | 'Draft' | 'Submitted';

export interface MyInterview {
  id: number;
  candidateId: number;
  candidateName: string;
  role: string | null;
  scheduledAt: string;
  evaluationState: EvaluationState;
}

export interface EvaluationItem {
  criterionKey: string;
  rating: number | null;
  comment: string | null;
}

export interface InterviewEvaluation {
  id: number;
  interviewerUserId: number;
  interviewerName: string;
  generalAssessment: string | null;
  recommendation: string | null;
  recommendationOther: string | null;
  overallRating: number | null;
  isSubmitted: boolean;
  submittedAt: string | null;
  items: EvaluationItem[];
}

export interface InterviewInterviewerInfo {
  userId: number;
  name: string;
}

export interface InterviewDetail {
  id: number;
  scheduledAt: string;
  candidate: CandidateDetail;
  interviewers: InterviewInterviewerInfo[];
  canEvaluate: boolean;
  myEvaluation: InterviewEvaluation | null;
  allEvaluations: InterviewEvaluation[] | null;
  notes: string | null;
  interviewTags: string[];
  durationMinutes: number;
}

// ----- Candidate evaluation report (Recruiter+) -----
export interface RecommendationCount {
  recommendation: string;
  count: number;
}

export interface CriterionAverage {
  criterionKey: string;
  average: number;
  count: number;
}

export interface EvaluationReportSummary {
  interviewerCount: number;
  averageOverall: number | null;
  recommendationCounts: RecommendationCount[];
  criterionAverages: CriterionAverage[];
}

export interface ReportEvaluation {
  interviewId: number;
  scheduledAt: string;
  interviewTags: string[];
  evaluation: InterviewEvaluation;
}

export interface CandidateEvaluationReport {
  candidateId: number;
  fullName: string;
  roleApplied: string | null;
  summary: EvaluationReportSummary;
  evaluations: ReportEvaluation[];
}

export interface UpsertEvaluationPayload {
  generalAssessment: string | null;
  recommendation: string | null;
  recommendationOther: string | null;
  overallRating: number | null;
  items: EvaluationItem[];
  submit: boolean;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

// ----- Email / SMTP settings (SuperAdmin) -----
export interface EmailSettings {
  host: string;
  port: number;
  user: string | null;
  fromAddress: string;
  fromName: string;
  useStartTls: boolean;
  enabled: boolean;
  passwordSet: boolean;
  updatedAt: string | null;
}

export interface UpsertEmailSettings {
  host: string;
  port: number;
  user: string | null;
  password: string | null; // write-only; blank keeps the stored password
  fromAddress: string;
  fromName: string;
  useStartTls: boolean;
  enabled: boolean;
}

// ----- Offers & Compensation -----
export interface OfferApproval {
  id: number;
  offerId: number;
  approverUserId: number;
  approverName: string;
  approverEmail: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  comment: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export type OfferStatus =
  | 'Draft'
  | 'PendingApproval'
  | 'Approved'
  | 'Extended'
  | 'Accepted'
  | 'Declined'
  | 'Withdrawn';

export interface Offer {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  baseSalary: number;
  currency: string;
  bonus: number | null;
  equity: string | null;
  startDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  status: OfferStatus;
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  extendedAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  approvals: OfferApproval[];
}

export interface CreateOfferPayload {
  jobTitle?: string;
  baseSalary: number;
  currency?: string;
  bonus?: number | null;
  equity?: string | null;
  startDate?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
}

export interface UpdateOfferPayload extends CreateOfferPayload {}

export interface ReviewOfferApprovalPayload {
  decision: 'Approved' | 'Rejected';
  comment?: string;
}

export interface OfferDecisionPayload {
  decision: 'Accepted' | 'Declined';
  reason?: string;
}

export interface OfferMetrics {
  totalOffers: number;
  activeOffers: number;
  acceptedOffers: number;
  declinedOffers: number;
  totalHired: number;
  acceptanceRatePercentage: number;
}

// ----- Evaluation Rubrics -----
export interface RubricCriterion {
  id: number;
  evaluationRubricId: number;
  sectionName: string;
  key: string;
  label: string;
  hint?: string | null;
  weight: number;
  sortOrder: number;
}

export interface EvaluationRubric {
  id: number;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  criteriaCount: number;
  assignedRolesCount: number;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertRubricCriterionPayload {
  id?: number;
  sectionName: string;
  key: string;
  label: string;
  hint?: string | null;
  weight?: number;
  sortOrder?: number;
}

export interface UpsertEvaluationRubricPayload {
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  criteria: UpsertRubricCriterionPayload[];
}

// ----- Recruiting Operational Analytics -----
export interface AnalyticsFilterParams {
  preset?: string;
  from?: string;
  to?: string;
  roleId?: number;
}

export interface TimeToHireMetrics {
  averageDays: number;
  medianDays: number;
  fastestDays: number;
  longestDays: number;
  totalHires: number;
  changeVsPreviousPeriodPercent: number | null;
}

export interface StageVelocity {
  stageName: string;
  sortOrder: number;
  averageDays: number;
  medianDays: number;
  candidatesCount: number;
}

export interface FunnelStage {
  stageKey: string;
  stageName: string;
  stepNumber: number;
  totalEntered: number;
  conversionFromStartPercent: number;
  conversionFromPreviousPercent: number;
  dropoffCount: number;
}

export interface SourcePerformance {
  sourceId: number | null;
  sourceName: string;
  totalApplicants: number;
  screenedCount: number;
  interviewedCount: number;
  offeredCount: number;
  hiredCount: number;
  conversionToHirePercent: number;
  shareOfTotalHiresPercent: number;
}

export interface RecruiterWorkload {
  recruiterUserId: number;
  recruiterName: string;
  activeCandidates: number;
  totalAssigned: number;
  transitionsLogged: number;
  interviewsParticipated: number;
  hiresMade: number;
}

export interface RecruitingAnalyticsSummary {
  timeToHire: TimeToHireMetrics;
  averagePipelineDays: number;
  overallFunnelConversionRate: number;
  totalCandidatesInPeriod: number;
  activeCandidates: number;
  funnelStages: FunnelStage[];
  stageVelocities: StageVelocity[];
  sourcingChannels: SourcePerformance[];
  recruiterWorkloads: RecruiterWorkload[];
  periodStart: string;
  periodEnd: string;
}


