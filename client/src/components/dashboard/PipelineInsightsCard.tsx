import { useState } from 'react';
import SectionCard from '../common/SectionCard';
import CountBarChart from './CountBarChart';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import type { NameCount } from '../../types';

/**
 * Candidates by role and top skills in one card with a switch, rather than two
 * side-by-side cards of which one was usually an empty state.
 */
export default function PipelineInsightsCard({ byRole, topSkills }: { byRole: NameCount[]; topSkills: NameCount[] }) {
  const [tab, setTab] = useState<'roles' | 'skills'>('roles');

  return (
    <SectionCard
      title="Insights"
      description={tab === 'roles' ? 'Your candidates by role.' : 'Most common skills on your candidates.'}
      actions={
        <Segmented
          type="single"
          value={tab}
          onValueChange={(v) => (v === 'roles' || v === 'skills') && setTab(v)}
          aria-label="Insight shown"
        >
          <SegmentedItem value="roles">Roles</SegmentedItem>
          <SegmentedItem value="skills">Skills</SegmentedItem>
        </Segmented>
      }
    >
      {tab === 'roles' ? (
        <CountBarChart data={byRole} emptyLabel="No roles recorded yet." />
      ) : (
        <CountBarChart data={topSkills} emptyLabel="No skills recorded yet." />
      )}
    </SectionCard>
  );
}
