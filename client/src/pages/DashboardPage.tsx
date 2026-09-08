import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, ListGroup } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveRoleOptions,
  getApplicationsTrend,
  getDashboard,
  getDashboardKpis,
  getJobOpenings,
  getOfferMetrics,
  getStatusBreakdown,
} from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import KpiCard from '../components/dashboard/KpiCard';
import OfferMetricsCard from '../components/dashboard/OfferMetricsCard';
import {
  IdCardIcon,
  HourglassIcon,
  PersonCheckIcon,
  PersonXIcon,
  CalendarPlusIcon,
  ShareIcon,
} from '../components/dashboard/kpiIcons';
import StatusDonutChart from '../components/dashboard/StatusDonutChart';
import TrendChart from '../components/dashboard/TrendChart';
import CountBarChart from '../components/dashboard/CountBarChart';
import ActiveJobOpeningsTable from '../components/dashboard/ActiveJobOpeningsTable';
import MyInterviewsCard from '../components/dashboard/MyInterviewsCard';
import DashboardHero from '../components/dashboard/DashboardHero';
import EmptyState from '../components/ui/EmptyState';
import Page from '../components/ui/Page';
import SectionCard from '../components/ui/SectionCard';
import { SkeletonCards } from '../components/ui/Loading';
import { useAuth } from '../auth/AuthContext';
import type { ActivityItem, UpcomingInterview } from '../types';

const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const isSoon = (iso: string): boolean => new Date(iso).getTime() - Date.now() < 24 * 3600 * 1000;

const TREND_RANGES = [7, 30, 90] as const;

function InterviewRow({ item }: { item: UpcomingInterview }) {
  return (
    <ListGroup.Item className="list-row">
      <div className="list-row__main">
        <Link to={`/candidates/${item.candidateId}`} className="list-row__title">
          {item.fullName}
        </Link>
        <div className="list-row__meta">{item.role ?? '—'}</div>
      </div>
      <div className="list-row__aside">
        <div className={`list-row__meta${isSoon(item.interviewAt) ? ' list-row__meta--urgent' : ''}`}>
          {new Date(item.interviewAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <StatusBadge status={item.currentStatus} />
      </div>
    </ListGroup.Item>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <ListGroup.Item className="list-row">
      <div className="list-row__main">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Link to={`/candidates/${item.candidateId}`} className="list-row__title">
            {item.fullName}
          </Link>
          <StatusBadge status={item.status} />
        </div>
        <div className="list-row__meta">by {item.changedBy}</div>
      </div>
      <span className="list-row__meta flex-shrink-0">{relativeTime(item.changedAt)}</span>
    </ListGroup.Item>
  );
}

export default function DashboardPage() {
  const { canWriteCandidates, isAdminOrAbove } = useAuth();
  const [trendDays, setTrendDays] = useState<number>(30);
  // Recruiter-only dashboard role filter ('all' = every accessible candidate).
  const [roleFilter, setRoleFilter] = useState<number | 'all'>('all');
  const isRecruiterOnly = canWriteCandidates && !isAdminOrAbove;

  // Org-wide figures — every role sees the same numbers.
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: getDashboardKpis,
  });
  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ['dashboard', 'status-breakdown'],
    queryFn: getStatusBreakdown,
  });
  const { data: trend = [] } = useQuery({
    queryKey: ['dashboard', 'trend', trendDays],
    queryFn: () => getApplicationsTrend(trendDays),
  });
  const { data: jobOpenings = [] } = useQuery({
    queryKey: ['dashboard', 'job-openings'],
    queryFn: getJobOpenings,
  });

  // A recruiter's assigned roles, for their dashboard filter.
  const { data: assignedRoles = [] } = useQuery({
    queryKey: ['role-options', 'active'],
    queryFn: getActiveRoleOptions,
    enabled: isRecruiterOnly,
  });

  // Owner-scoped, candidate-centric sections — only for roles that manage candidates.
  const scopedRoleId = isRecruiterOnly && roleFilter !== 'all' ? roleFilter : undefined;
  const { data: scoped } = useQuery({
    queryKey: ['dashboard', 'scoped', scopedRoleId ?? 'all'],
    queryFn: () => getDashboard(scopedRoleId),
    enabled: canWriteCandidates,
  });

  const { data: offerMetrics } = useQuery({
    queryKey: ['dashboard', 'offer-metrics'],
    queryFn: getOfferMetrics,
    enabled: canWriteCandidates,
  });

  // The hero and the sections below it don't depend on the KPI query, so a
  // slow KPI fetch no longer blanks the whole page — only the tile row waits.
  const total = kpis?.totalCandidates ?? 0;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  // Interviewers can see the figures but not the candidate list, so their
  // tiles must not offer a link into a page they'd be bounced out of.
  const to = (href: string) => (canWriteCandidates ? href : undefined);

  return (
    <Page>
      <DashboardHero />

      {kpisError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the pipeline figures"
          description="The rest of the dashboard is still available. Refresh to try the figures again."
        />
      ) : kpisLoading || !kpis ? (
        <SkeletonCards count={6} label="Loading pipeline figures" />
      ) : (
        /* Every tile drills through to the list showing exactly what it
           counts. The multi-status and date-window ones go via `bucket`, which
           the API resolves with the same definitions the dashboard uses (see
           CandidateBuckets), so a tile and its list can't disagree. */
        <div className="kpi-grid">
          <KpiCard tone="orange" icon={<IdCardIcon />} label="Total" value={total} sub="All candidates" percent={100} to={to('/candidates')} />
          <KpiCard tone="teal" icon={<HourglassIcon />} label="In process" value={kpis.inProcess} sub="Of total" percent={pct(kpis.inProcess)} to={to('/candidates?bucket=in-process')} />
          <KpiCard tone="green" icon={<PersonCheckIcon />} label="Recommended" value={kpis.recommended} sub="Of total" percent={pct(kpis.recommended)} to={to('/candidates?bucket=recommended')} />
          <KpiCard tone="red" icon={<PersonXIcon />} label="Rejected" value={kpis.rejected} sub="Of total" percent={pct(kpis.rejected)} to={to('/candidates?bucket=rejected')} />
          <KpiCard tone="blue" icon={<CalendarPlusIcon />} label="New this week" value={kpis.newThisWeek} sub="Of total" percent={pct(kpis.newThisWeek)} to={to('/candidates?bucket=new-this-week')} />
          <KpiCard tone="purple" icon={<ShareIcon />} label="Referred" value={kpis.referredCount} sub="Of total" percent={kpis.referredPercent} to={to('/candidates?referred=1')} />
        </div>
      )}

      <MyInterviewsCard />

      {/* Status breakdown + applications trend. asymmetric-2 gives the trend the
          wider column: a time series needs horizontal room, a donut doesn't. */}
      <div className="grid-2 grid-2--asymmetric">
        <SectionCard title="Status breakdown" description="Where every candidate currently sits.">
          <StatusDonutChart data={statusBreakdown} />
        </SectionCard>

        <SectionCard
          title="Applications"
          description={`New candidates over the last ${trendDays} days.`}
          actions={
            <div className="btn-group btn-group-sm" role="group" aria-label="Trend range">
              {TREND_RANGES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn ${trendDays === d ? 'btn-primary' : 'btn-outline-secondary'}`}
                  aria-pressed={trendDays === d}
                  onClick={() => setTrendDays(d)}
                >
                  {d}D
                </button>
              ))}
            </div>
          }
        >
          <TrendChart data={trend} />
        </SectionCard>
      </div>

      <ActiveJobOpeningsTable data={jobOpenings} />

      {/* Candidate-centric sections — only for candidate-managing roles. */}
      {canWriteCandidates && (
        <>
          <div className="section-head">
            <div className="min-w-0">
              <h2 className="section-title">My pipeline</h2>
              <p className="section-description">
                Scoped to the candidates you can access.
              </p>
            </div>
            {isRecruiterOnly && assignedRoles.length > 0 && (
              <div className="section-head__actions">
                <Form.Label htmlFor="pipeline-role" className="mb-0 form-help">
                  Role
                </Form.Label>
                <Form.Select
                  id="pipeline-role"
                  size="sm"
                  style={{ width: 'auto' }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">All my roles</option>
                  {assignedRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Form.Select>
              </div>
            )}
          </div>

          {offerMetrics && offerMetrics.totalOffers > 0 && (
            <OfferMetricsCard metrics={offerMetrics} />
          )}

          <div className="grid-2">
            <SectionCard title="Candidates by role">
              <CountBarChart data={scoped?.byRole ?? []} emptyLabel="No roles recorded yet." />
            </SectionCard>
            <SectionCard title="Top skills">
              <CountBarChart data={scoped?.topSkills ?? []} emptyLabel="No skills recorded yet." />
            </SectionCard>
          </div>

          <div className="grid-2">
            <SectionCard title="Upcoming interviews">
              {(scoped?.upcomingInterviews ?? []).length === 0 ? (
                <EmptyState
                  title="No interviews scheduled"
                  description="Scheduling an interview from a candidate's status history will list it here."
                />
              ) : (
                <ListGroup variant="flush">
                  {scoped!.upcomingInterviews.map((i, idx) => (
                    <InterviewRow key={`${i.candidateId}-${idx}`} item={i} />
                  ))}
                </ListGroup>
              )}
            </SectionCard>

            <SectionCard title="Recent activity">
              {(scoped?.recentActivity ?? []).length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Status changes on your candidates will show up here."
                />
              ) : (
                <ListGroup variant="flush">
                  {scoped!.recentActivity.map((a, idx) => (
                    <ActivityRow key={`${a.candidateId}-${idx}`} item={a} />
                  ))}
                </ListGroup>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </Page>
  );
}
