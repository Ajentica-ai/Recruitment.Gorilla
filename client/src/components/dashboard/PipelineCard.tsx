import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import SectionCard from '../common/SectionCard';
import { StatusBadge } from '../StatusBadge';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { getStatusClass, getStatusTone } from '../../utils/statusColors';
import { cn } from '@/lib/utils';
import type { StatusCount } from '../../types';

const VISIBLE = 5;

const statusHref = (status: string) => `/candidates?status=${encodeURIComponent(status)}`;

/**
 * Where every candidate sits now: one stacked bar plus a row per stage.
 *
 * It replaces a donut that real data broke: with 72 of 82 candidates still at
 * "Uploaded", every other stage was a sliver too thin to see or hover. "Active"
 * drops that intake stage so the rest of the pipeline is readable, and every
 * row (and bar segment) opens the list of exactly those candidates.
 *
 * `canDrill` is false for Interviewers, who can't open the candidate list, so
 * the rows render as plain figures for them.
 */
export default function PipelineCard({ data, canDrill }: { data: StatusCount[]; canDrill: boolean }) {
  const [mode, setMode] = useState<'all' | 'active'>('all');
  const [showAll, setShowAll] = useState(false);

  const stages = data.filter((s) => s.count > 0 && (mode === 'all' || getStatusTone(s.status) !== 'uploaded'));
  const total = stages.reduce((n, s) => n + s.count, 0);
  const share = (n: number) => (total === 0 ? 0 : Math.round((n * 1000) / total) / 10);
  const rows = showAll ? stages : stages.slice(0, VISIBLE);

  return (
    <SectionCard
      title="Pipeline"
      description={
        mode === 'all'
          ? `${total.toLocaleString()} candidates, by current stage.`
          : `${total.toLocaleString()} candidates past intake.`
      }
      actions={
        <Segmented
          type="single"
          value={mode}
          onValueChange={(v) => {
            if (v === 'all' || v === 'active') {
              setMode(v);
              setShowAll(false);
            }
          }}
          aria-label="Stages shown"
        >
          <SegmentedItem value="all">All</SegmentedItem>
          <SegmentedItem value="active">Active</SegmentedItem>
        </Segmented>
      }
    >
      {total === 0 ? (
        <div className="slim-empty">
          <Users size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            <strong>No candidates {mode === 'active' ? 'past intake' : 'yet'}.</strong>{' '}
            {mode === 'active' ? 'Everyone is still at the first stage.' : 'Uploaded CVs will show here by stage.'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* The rows below are the accessible version of this bar; the
              segments are a pointer shortcut, so they stay out of the tab order. */}
          <div className="pipeline-bar" aria-hidden="true">
            {stages.map((s) => {
              const cls = cn('pipeline-bar__seg', getStatusClass(s.status));
              const title = `${s.status}: ${s.count}`;
              return canDrill ? (
                <Link key={s.status} to={statusHref(s.status)} tabIndex={-1} className={cls} title={title} style={{ flexGrow: s.count }} />
              ) : (
                <span key={s.status} className={cls} title={title} style={{ flexGrow: s.count }} />
              );
            })}
          </div>

          <ul className="m-0 list-none p-0">
            {rows.map((s) => {
              const pct = share(s.count);
              const content = (
                <>
                  <span className="stage-row__name">
                    <StatusBadge status={s.status} />
                  </span>
                  <span className="stage-row__count">{s.count.toLocaleString()}</span>
                  <span className="stage-row__share">{pct}%</span>
                  {canDrill && <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" className="row-chevron" />}
                </>
              );
              return (
                <li key={s.status}>
                  {canDrill ? (
                    <Link
                      to={statusHref(s.status)}
                      className="stage-row"
                      aria-label={`${s.status}: ${s.count} candidates, ${pct} percent. View them.`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="stage-row">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {stages.length > VISIBLE && (
            <button type="button" className="dash-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer stages' : `Show all ${stages.length} stages`}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
