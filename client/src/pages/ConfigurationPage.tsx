import {
  createInterviewTypeOption,
  createSkillOption,
  createSourceOption,
  deleteInterviewTypeOption,
  deleteSkillOption,
  deleteSourceOption,
  getInterviewTypeOptions,
  getSkillOptions,
  getSourceOptions,
  updateInterviewTypeOption,
  updateSkillOption,
  updateSourceOption,
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import Page from '../components/common/Page';
import Tabs, { TabPanel, type TabDef } from '../components/common/Tabs';
import { useTabs } from '../components/common/useTabs';
import JobOpeningsTab from './configuration/JobOpeningsTab';
import OptionChipsTab, { type OptionApi } from './configuration/OptionChipsTab';
import EmailSettingsTab from './configuration/EmailSettingsTab';
import EvaluationRubricsTab from './configuration/EvaluationRubricsTab';

const skillsApi: OptionApi = {
  list: getSkillOptions,
  create: createSkillOption,
  update: updateSkillOption,
  remove: deleteSkillOption,
};

const interviewTypesApi: OptionApi = {
  list: getInterviewTypeOptions,
  create: createInterviewTypeOption,
  update: updateInterviewTypeOption,
  remove: deleteInterviewTypeOption,
};

const sourcesApi: OptionApi = {
  list: getSourceOptions,
  create: createSourceOption,
  update: updateSourceOption,
  remove: deleteSourceOption,
};

/**
 * Configuration is several unrelated jobs, so it is a tab each rather than
 * stacked cards on one long scroll. The active tab lives in the query string,
 * so a refresh keeps your place and a section can be linked to.
 *
 * Email is Super Admin only; the tab is absent for everyone else rather than
 * present-and-failing, matching how the sidebar handles role-gated routes.
 */
export default function ConfigurationPage() {
  const { isSuperAdmin } = useAuth();

  const tabs: TabDef[] = [
    { id: 'rubrics', label: 'Evaluation rubrics' },
    { id: 'skills', label: 'Skills' },
    { id: 'sources', label: 'Candidate sources' },
    { id: 'interview-types', label: 'Interview types' },
    ...(isSuperAdmin ? [{ id: 'email', label: 'Email' }] : []),
    { id: 'jobs', label: 'Job openings' },
  ];

  const [active, setActive] = useTabs(tabs);

  return (
    <Page>
      <Tabs tabs={tabs} active={active} onChange={setActive} ariaLabel="Configuration sections" />

      {active === 'jobs' && (
        <TabPanel id="jobs">
          <JobOpeningsTab />
        </TabPanel>
      )}

      {active === 'rubrics' && (
        <TabPanel id="rubrics">
          <EvaluationRubricsTab />
        </TabPanel>
      )}

      {active === 'skills' && (
        <TabPanel id="skills">
          <OptionChipsTab
            noun="skill"
            queryKey="skills"
            api={skillsApi}
            addPlaceholder="Add a skill…"
            description="Skills candidates can be tagged with. These appear in the candidate form's skills picker and as coloured badges on profiles."
          />
        </TabPanel>
      )}

      {active === 'sources' && (
        <TabPanel id="sources">
          <OptionChipsTab
            noun="source"
            queryKey="sources"
            api={sourcesApi}
            addPlaceholder="Add a source…"
            description="Where candidates come from — referral, job board, agency and so on. Recorded on each candidate so you can compare which channels actually produce hires."
          />
        </TabPanel>
      )}

      {active === 'interview-types' && (
        <TabPanel id="interview-types">
          <OptionChipsTab
            noun="interview type"
            queryKey="interview-types"
            api={interviewTypesApi}
            addPlaceholder="Add a type…"
            description="Interview types used as tags when scheduling — shown on the interview page and the candidate timeline."
          />
        </TabPanel>
      )}

      {active === 'email' && isSuperAdmin && (
        <TabPanel id="email">
          <EmailSettingsTab />
        </TabPanel>
      )}
    </Page>
  );
}
