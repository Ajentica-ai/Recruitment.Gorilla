import {
  createJobOpeningOption,
  deleteJobOpeningOption,
  getJobOpeningOptions,
  updateJobOpeningOption,
} from '../../services/api';
import type { JobOpeningOptionKind } from '../../types';
import OptionChipsTab, { type OptionApi } from './OptionChipsTab';

const apiFor = (kind: JobOpeningOptionKind): OptionApi => ({
  list: (includeInactive) => getJobOpeningOptions(kind, includeInactive),
  create: (p) => createJobOpeningOption(kind, p),
  update: (id, p) => updateJobOpeningOption(kind, id, p),
  remove: (id) => deleteJobOpeningOption(kind, id),
});

const locationApi = apiFor('location');
const departmentApi = apiFor('department');
const priorityApi = apiFor('priority');

/**
 * The value lists behind a job opening's Location, Department and Priority fields.
 * Renaming a value updates the openings that use it; a value still in use is
 * deactivated instead of deleted, so it stays on existing openings.
 */
export default function JobOpeningFieldsTab() {
  return (
    <div className="flex flex-col gap-6">
      <OptionChipsTab
        noun="location"
        queryKey="job-location"
        api={locationApi}
        addPlaceholder="Add a location…"
        description="Where a job opening is based, shown in the Location picker of the job opening form."
      />
      <OptionChipsTab
        noun="department"
        queryKey="job-department"
        api={departmentApi}
        addPlaceholder="Add a department…"
        description="Departments a job opening can belong to. Also used to filter the Jobs page."
      />
      <OptionChipsTab
        noun="priority"
        queryKey="job-priority"
        api={priorityApi}
        addPlaceholder="Add a priority…"
        description="Priority levels for job openings. High, Medium and Low get coloured badges; any other level shows a neutral badge."
      />
    </div>
  );
}