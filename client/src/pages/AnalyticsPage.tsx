import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Clock,
  Filter,
  Layers,
  Printer,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { getCandidateFilterRoleOptions, getRecruitingAnalytics } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { SkeletonRows } from '../components/common/Loading';
import type { AnalyticsFilterParams, RoleAppliedOption } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';

const PRESETS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' },
];

export default function AnalyticsPage() {
  const [preset, setPreset] = useState('30d');
  const [roleId, setRoleId] = useState<number | undefined>(undefined);

  // Role filter options
  const { data: roleOptions = [] } = useQuery<RoleAppliedOption[]>({
    queryKey: ['candidates', 'role-filter-options'],
    queryFn: getCandidateFilterRoleOptions,
  });

  // Query analytics data
  const filterParams: AnalyticsFilterParams = useMemo(
    () => ({
      preset,
      roleId,
    }),
    [preset, roleId]
  );

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['analytics', 'summary', filterParams],
    queryFn: () => getRecruitingAnalytics(filterParams),
  });

  return (
    <div className="analytics-page">
      {/* Top Filter and Action Bar */}
      <div className="page-bar print:hidden">
        <div className="flex items-center flex-wrap gap-2 grow">
          {/* Preset Segmented Control */}
          <div className="segmented" role="group" aria-label="Select date range preset">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                className={preset === p.id ? 'active' : ''}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Job Opening / Role Filter */}
          <div className="flex items-center gap-1.5" style={{ minWidth: 220 }}>
            <Filter size={14} className="text-muted-foreground shrink-0" />
            <NativeSelect
              size="sm"
              value={roleId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setRoleId(val ? parseInt(val, 10) : undefined);
              }}
              aria-label="Filter by job opening"
            >
              <option value="">All Job Openings</option>
              {roleOptions.map((r: RoleAppliedOption) => (
                <option key={r.id} value={r.id}>
                  {r.name} {!r.isActive ? '(Inactive)' : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="page-bar__actions">
          <Button
            variant="outline"
            className="flex items-center gap-1.5"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} label="Calculating recruitment analytics" />
      ) : isError || !summary ? (
        <EmptyState
          variant="error"
          title="Could not load recruiting operational analytics"
          description="An error occurred while calculating velocity and funnel metrics."
          action={<Button onClick={() => void refetch()}>Try Again</Button>}
        />
      ) : (
        <>
          {/* KPI Ribbon */}
          <div className="analytics-kpi-grid">
            {/* Avg Time to Hire */}
            <div className="analytics-card analytics-card--kpi">
              <div className="analytics-card__header">
                <h4 className="analytics-card__title">Average time to hire</h4>
                <div className="analytics-card__icon-badge">
                  <Clock size={16} />
                </div>
              </div>
              <p className="analytics-card__value">
                {summary.timeToHire.totalHires > 0
                  ? `${summary.timeToHire.averageDays} days`
                  : '—'}
              </p>
              <div className="analytics-card__subtext">
                {summary.timeToHire.totalHires > 0 ? (
                  <span>
                    Fastest: <strong>{summary.timeToHire.fastestDays}d</strong> · Longest:{' '}
                    <strong>{summary.timeToHire.longestDays}d</strong>
                  </span>
                ) : (
                  <span>No hires recorded in this period</span>
                )}
              </div>
            </div>

            {/* Pipeline Velocity */}
            <div className="analytics-card analytics-card--kpi">
              <div className="analytics-card__header">
                <h4 className="analytics-card__title">Pipeline velocity</h4>
                <div className="analytics-card__icon-badge">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="analytics-card__value">
                {summary.averagePipelineDays > 0
                  ? `${summary.averagePipelineDays} days`
                  : '—'}
              </p>
              <div className="analytics-card__subtext">
                <span>Average dwell across active stages</span>
              </div>
            </div>

            {/* Overall Funnel Conversion */}
            <div className="analytics-card analytics-card--kpi">
              <div className="analytics-card__header">
                <h4 className="analytics-card__title">Funnel conversion</h4>
                <div className="analytics-card__icon-badge">
                  <Sparkles size={16} />
                </div>
              </div>
              <div className="analytics-card__value-wrap">
                <p className="analytics-card__value">
                  {summary.overallFunnelConversionRate}%
                </p>
              </div>
              <div className="analytics-card__subtext">
                <span>
                  <strong>{summary.timeToHire.totalHires}</strong>{' '}
                  {summary.timeToHire.totalHires === 1 ? 'hire' : 'hires'} from{' '}
                  <strong>{summary.totalCandidatesInPeriod}</strong>{' '}
                  {summary.totalCandidatesInPeriod === 1 ? 'applicant' : 'applicants'}
                </span>
              </div>
            </div>

            {/* Active Pipeline Candidates */}
            <div
              className="analytics-card analytics-card--kpi"
              title="Candidates advancing through screening, assessments, interviews or offers"
            >
              <div className="analytics-card__header">
                <h4 className="analytics-card__title">Active pipeline</h4>
                <div className="analytics-card__icon-badge">
                  <Users size={16} />
                </div>
              </div>
              <p className="analytics-card__value">{summary.activeCandidates}</p>
              <div className="analytics-card__subtext">
                <span>In active consideration</span>
              </div>
            </div>
          </div>

          {/* Horizontal Stepped Pipeline Funnel */}
          <div className="analytics-card">
            <div className="analytics-card__header">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-muted-foreground" />
                <h3 className="section-title">Pipeline funnel</h3>
              </div>
              <span className="text-muted-foreground text-[length:var(--text-sm)] font-medium">
                {summary.totalCandidatesInPeriod}{' '}
                {summary.totalCandidatesInPeriod === 1 ? 'applicant' : 'applicants'} entered pipeline
              </span>
            </div>

            <div className="stepped-funnel">
              {summary.funnelStages.map((stage, idx) => {
                const prevStage = idx > 0 ? summary.funnelStages[idx - 1] : null;
                const passRate =
                  prevStage && prevStage.totalEntered > 0
                    ? Math.round((stage.totalEntered / prevStage.totalEntered) * 100)
                    : null;

                const cleanStageName = stage.stageName.replace(/^\d+\.\s*/, '');
                const isHired = stage.stageKey === 'hired';

                return (
                  <div key={stage.stageKey} className="flex items-stretch grow min-w-0">
                    {idx > 0 && (
                      <div className="stepped-funnel__connector">
                        <span
                          className="stepped-funnel__connector-rate"
                          title={`${passRate}% step pass-through from previous stage`}
                        >
                          {passRate}%
                        </span>
                      </div>
                    )}

                    <div
                      className={`stepped-funnel__node ${
                        isHired ? 'stepped-funnel__node--hired' : ''
                      }`}
                    >
                      <div className="stepped-funnel__node-header">
                        <div className="stepped-funnel__node-badge">{idx + 1}</div>
                        <span className="stepped-funnel__node-title truncate">
                          {cleanStageName}
                        </span>
                      </div>

                      <div className="stepped-funnel__node-body">
                        <span className="stepped-funnel__node-count">
                          {stage.totalEntered}
                        </span>
                        <span className="stepped-funnel__node-sub">
                          {stage.conversionFromStartPercent}% conversion
                        </span>
                        <div className="stepped-funnel__node-bar">
                          <div
                            className="stepped-funnel__node-bar-fill"
                            /* One flat fill for every stage but the last.
                               Five two-stop gradients on a 4px track read as
                               five arbitrary colours, and they implied the
                               stages differ in kind when they only differ in
                               position — which the bar's length already says.
                               "Hired" is the one stage with an outcome, so it
                               is the one that gets a colour of its own. */
                            style={{
                              width: `${Math.max(4, stage.conversionFromStartPercent)}%`,
                              background: isHired ? 'var(--success)' : 'var(--primary)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Dwell Time & Velocity Bottlenecks */}
          <div className="analytics-card">
            <div className="analytics-card__header">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <h3 className="section-title">Stage dwell time</h3>
              </div>
              <span className="text-muted-foreground text-[length:var(--text-sm)] font-medium">Average days per candidate</span>
            </div>

            {summary.stageVelocities.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-[length:var(--text-sm)]">
                No active status transition history available in this period.
              </div>
            ) : (
              <div className="velocity-grid">
                {summary.stageVelocities.map((v) => {
                  const maxDays = Math.max(
                    ...summary.stageVelocities.map((x) => x.averageDays),
                    1
                  );
                  const pct = Math.round((v.averageDays / maxDays) * 100);
                  const isSlow = v.averageDays > 7.0;
                  const isFast = v.averageDays < 3.0;
                  const formattedName = v.stageName.replace(
                    'Ask for Assesment',
                    'Ask for Assessment'
                  );

                  return (
                    <div
                      key={v.stageName}
                      className={`velocity-row${isSlow ? ' velocity-row--slow' : ''}`}
                    >
                      <div className="velocity-row__header">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="velocity-row__name" title={formattedName}>
                            {formattedName}
                          </span>
                          {isSlow && (
                            <Badge
                              variant="warning"
                              className="shrink-0"
                              title="Stage dwell exceeds 7 days threshold"
                            >
                              Bottleneck
                            </Badge>
                          )}
                        </div>
                        <div className="velocity-row__value">
                          <strong>{v.averageDays}d</strong>{' '}
                          <span className="text-muted-foreground font-normal text-[length:var(--text-sm)]">
                            ({v.candidatesCount})
                          </span>
                        </div>
                      </div>
                      <div className="velocity-row__bar-track">
                        <div
                          className={`velocity-row__bar-fill ${
                            isSlow
                              ? 'velocity-row__bar-fill--slow'
                              : isFast
                              ? 'velocity-row__bar-fill--fast'
                              : 'velocity-row__bar-fill--steady'
                          }`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sourcing Channel ROI Table */}
          <div className="analytics-card">
            <div className="analytics-card__header">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-muted-foreground" />
                <h5 className="mb-0 font-bold text-[length:var(--text-lg)]">Sourcing Channel Performance & ROI</h5>
              </div>
              <span className="text-muted-foreground text-[length:var(--text-sm)] font-medium">
                {summary.sourcingChannels.length} sourcing channels tracked
              </span>
            </div>

            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Sourcing Channel</th>
                    <th className="text-center">Applicants</th>
                    <th className="text-center">Screened</th>
                    <th className="text-center">Interviewed</th>
                    <th className="text-center">Offered</th>
                    <th className="text-center">Hires</th>
                    <th className="text-center">Conversion to Hire</th>
                    <th className="text-center">Share of Hires</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sourcingChannels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted-foreground py-6">
                        No sourcing data found in this period.
                      </td>
                    </tr>
                  ) : (
                    summary.sourcingChannels.map((s) => (
                      <tr key={s.sourceName}>
                        <td className="font-semibold">
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral">{s.sourceName}</Badge>
                          </div>
                        </td>
                        <td className="text-center">{s.totalApplicants}</td>
                        <td className="text-center">{s.screenedCount}</td>
                        <td className="text-center">{s.interviewedCount}</td>
                        <td className="text-center">{s.offeredCount}</td>
                        <td className="text-center">
                          <strong className={s.hiredCount > 0 ? 'text-success-foreground' : ''}>
                            {s.hiredCount}
                          </strong>
                        </td>
                        <td className="text-center">
                          <Badge variant="brand">{s.conversionToHirePercent}%</Badge>
                        </td>
                        <td className="text-center text-muted-foreground">
                          {s.shareOfTotalHiresPercent}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recruiter Productivity & Workload Table */}
          <div className="analytics-card">
            <div className="analytics-card__header">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-muted-foreground" />
                <h5 className="mb-0 font-bold text-[length:var(--text-lg)]">Recruiter Productivity & Pipeline Workload</h5>
              </div>
              <span className="text-muted-foreground text-[length:var(--text-sm)] font-medium">
                {summary.recruiterWorkloads.length} active recruiters
              </span>
            </div>

            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Recruiter</th>
                    <th className="text-center">Active Pipeline</th>
                    <th className="text-center">Total Assigned</th>
                    <th className="text-center">Status Actions</th>
                    <th className="text-center">Interviews Conducted</th>
                    <th className="text-center">Hires Contributed</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recruiterWorkloads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-6">
                        No recruiter workload data recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    summary.recruiterWorkloads.map((r) => (
                      <tr key={r.recruiterUserId}>
                        <td className="font-semibold">
                          <div className="flex items-center gap-2">
                            <div
                              className="rounded-full bg-primary-subtle text-brand font-bold flex items-center justify-center"
                              style={{ width: 28, height: 28, fontSize: 11 }}
                            >
                              {r.recruiterName.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{r.recruiterName}</span>
                          </div>
                        </td>
                        <td className="text-center">
                          <Badge variant="neutral">{r.activeCandidates} active</Badge>
                        </td>
                        <td className="text-center">{r.totalAssigned}</td>
                        <td className="text-center">{r.transitionsLogged}</td>
                        <td className="text-center">{r.interviewsParticipated}</td>
                        <td className="text-center">
                          <strong className={r.hiresMade > 0 ? 'text-success-foreground' : ''}>
                            {r.hiresMade}
                          </strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
