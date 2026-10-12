import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import UploadPage from './UploadPage';

let isAdminOrAbove = false;

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isAdminOrAbove }),
}));

vi.mock('../components/BulkUploader', () => ({ default: () => <div>CV uploader</div> }));
vi.mock('../components/JsonImporter', () => ({ default: () => <div>JSON importer</div> }));
vi.mock('../components/drafts/DraftReviewWorkspace', () => ({ default: () => null }));
vi.mock('../services/api', () => ({
  getCandidateDrafts: vi.fn().mockResolvedValue({ totalPending: 0 }),
}));

describe('UploadPage intake switch', () => {
  it('lets an Admin (or Super Admin) switch to the JSON importer', async () => {
    isAdminOrAbove = true;
    renderWithProviders(<UploadPage />);

    expect(screen.getByText('CV uploader')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /JSON \+ CVs/ }));
    expect(screen.getByText('JSON importer')).toBeInTheDocument();
  });

  it('shows no switch and only the CV uploader to a Recruiter', () => {
    isAdminOrAbove = false;
    renderWithProviders(<UploadPage />);

    expect(screen.queryByRole('radio', { name: /JSON \+ CVs/ })).not.toBeInTheDocument();
    expect(screen.getByText('CV uploader')).toBeInTheDocument();
    expect(screen.queryByText('JSON importer')).not.toBeInTheDocument();
  });
});
