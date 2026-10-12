import { useState } from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getActiveRoleOptions,
  getApplicationsSummary,
  getApplicationsTrend,
  getDashboard,
  getDashboardKpis,
  getJobOpenings,
  getOfferMetrics,
  getStatusBreakdown,
} from '../services/api';
import DashboardHero from '../components/dashboard/DashboardHero';
import UpNextCard from '../components/dashboard/UpNextCard';
import KpiStrip from '../components/dashboard/KpiStrip';
import PipelineCard from '../components/dashboard/PipelineCard';
import TrendChart from '../components/dashboard/TrendChart';
import ActiveJobOpeningsCard from '../components/dashboard/ActiveJobOpeningsCard';
import PipelineInsightsCard from '../components/dashboard/PipelineInsightsCard';
import OfferMetricsCard from '../components/dashboard/OfferMetricsCard';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import QuickActionFab from '../components/dashboard/QuickActionFab';
import EmptyState from '../components/common/EmptyState';
import Page from '../components/common/Page';
import SectionCard from '../components/common/SectionCard';
import { SkeletonCards } from '../components/common/Loading';
import { useAuth } from '../auth/AuthContext';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';

const TREND_RANGES = [7, 30, 90] as const;

// The figures move when someone changes a status, not by the second. A minute
// keeps tab switches and remounts from refetching everything; status changes
// invalidate ['dashboard'] directly, and the hero's refresh does the same.
const STALE_MS = 60_000;

/**
 * Action-first dashboard (RG-134). Top to bottom: what needs you today (hero,
 * Up next), the pipeline figures, pipeline health (stages, applications), open
 * roles, then the owner-scoped "My pipeline" block for candidate-managing roles.
 *
 * Every query lives under ['dashboard'] (plus the shared ['my-interviews'] and
 * ['notifications']), so a status change elsewhere and the refresh control both
 * reach all of it.
 */
export default function DashboardPage() {
  const { canWriteCandidates, isAdminOrAbove } = useAuth();
  const queryClient = useQueryClient();
  const [trendDays, setTrendDays] = useState<number>(30);
  // Recruiter-only dashboard role filter ('all' = every accessible candidate).
  const [roleFilter, setRoleFilter] = useState<number | 'all'>('all');
  const isRecruiterOnly = canWriteCandidates && !isAdminOrAbove;

  // Org-wide figures: every role sees the same numbers.
  const kpisQuery = useQuery({ queryKey: ['dashboard', 'kpis'], queryFn: getDashboardKpis, staleTime: STALE_MS });
  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ['dashboard', 'status-breakdown'],
    queryFn: getStatusBreakdown,
    staleTime: STALE_MS,
  });
  const { data: trend = [] } = useQuery({
    queryKey: ['dashboard', 'trend', trendDays],
    queryFn: () => getApplicationsTrend(trendDays),
    staleTime: STALE_MS,
  });
  // The New-this-week sparkline needs the last 14 days whatever range the
  // chart shows; at the default range this is the same cached query.
  const { data: trend30 = [] } = useQuery({
    queryKey: ['dashboard', 'trend', 30],
    queryFn: () => getApplicationsTrend(30),
    staleTime: STALE_MS,
  });
  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'trend-summary', trendDays],
    queryFn: () => getApplicationsSummary(trendDays),
    staleTime: STALE_MS,
  });
  const { data: jobOpenings = [] } = useQuery({
    queryKey: ['dashboard', 'job-openings'],
    queryFn: getJobOpenings,
    staleTime: STALE_MS,
  });

  // A recruiter's assigned roles, for their dashboard filter.
  const { data: assignedRoles = [] } = useQuery({
    queryKey: ['role-options', 'active'],
    queryFn: getActiveRoleOptions,
    enabled: isRecruiterOnly,
  });

  // Owner-scoped, candidate-centric sections: only for roles that manage candidates.
  const scopedRoleId = isRecruiterOnly && roleFilter !== 'all' ? roleFilter : undefined;
  const { data: scoped } = useQuery({
    queryKey: ['dashboard', 'scoped', scopedRoleId ?? 'all'],
    queryFn: () => getDashboard(scopedRoleId),
    enabled: canWriteCandidates,
    staleTime: STALE_MS,
  });

  const { data: offerMetrics } = useQuery({
    queryKey: ['dashboard', 'offer-metrics'],
    queryFn: getOfferMetrics,
    enabled: canWriteCandidates,
    staleTime: STALE_MS,
  });

  const refreshing = useIsFetching({ queryKey: ['dashboard'] }) > 0;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['my-interviews'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const kpis = kpisQuery.data;
  const spark = trend30.slice(-14).map((p) => p.count);

  return (
    <Page className={canWriteCandidates ? 'dash-page--fab' : undefined}>
      <DashboardHero updatedAt={kpisQuery.dataUpdatedAt} refreshing={refreshing} onRefresh={refresh} />

      <div className="dash-row">
        {/* Interviewers get their own interviews only; Team is the scoped list. */}
        <UpNextCard team={canWriteCandidates ? (scoped?.upcomingInterviews ?? []) : undefined} />

        {kpisQuery.isError ? (
          <EmptyState
            variant="error"
            title="Couldn't load the pipeline figures"
            description="The rest of the dashboard is still available. Refresh to try the figures again."
          />
        ) : !kpis ? (
          <SkeletonCards count={6} label="Loading pipeline figures" />
        ) : (
          <KpiStrip kpis={kpis} spark={spark} canDrill={canWriteCandidates} />
        )}
      </div>

      <div className="dash-row">
        <PipelineCard data={statusBreakdown} canDrill={canWriteCandidates} />

        {/* The range picker is one setting with three values, which is what
            Segmented is for. */}
        <SectionCard
          title="Applications"
          description="New candidates per day."
          actions={
            <Segmented
              type="single"
              value={String(trendDays)}
              onValueChange={(v) => v && setTrendDays(Number(v))}
              aria-label="Trend range"
            >
              {TREND_RANGES.map((d) => (
                <SegmentedItem key={d} value={String(d)}>
                  {d}D
                </SegmentedItem>
              ))}
            </Segmented>
          }
        >
          <TrendChart key={trendDays} data={trend} summary={summary} days={trendDays} />
        </SectionCard>
      </div>

      <ActiveJobOpeningsCard data={jobOpenings} />

      {/* Candidate-centric sections: only for candidate-managing roles. */}
      {canWriteCandidates && (
        <>
          <div className="section-head">
            <div className="min-w-0">
              <h2 className="section-title">My pipeline</h2>
              <p className="section-description">Scoped to the candidates you can access.</p>
            </div>
            {isRecruiterOnly && assignedRoles.length > 0 && (
              <div className="section-head__actions">
                <Label htmlFor="pipeline-role" className="mb-0 form-help">
                  Role
                </Label>
                <NativeSelect
                  id="pipeline-role"
                  size="sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                >
                  <option value="all">All my roles</option>
                  {assignedRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>

          <div className="dash-row">
            <div className="dash-pair">
              <PipelineInsightsCard byRole={scoped?.byRole ?? []} topSkills={scoped?.topSkills ?? []} />
              {offerMetrics && offerMetrics.totalOffers > 0 && <OfferMetricsCard metrics={offerMetrics} />}
            </div>
            <ActivityFeed
              items={scoped?.recentActivity ?? []}
              viewAllHref={isAdminOrAbove ? '/audit' : '/candidates'}
            />
          </div>

          <QuickActionFab />
        </>
      )}
    </Page>
  );
}
