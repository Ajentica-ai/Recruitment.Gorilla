import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CvPreviewDialog from './CvPreviewDialog';
import { downloadCvFile } from '../services/api';

vi.mock('../services/api', () => ({ downloadCvFile: vi.fn() }));

const preview = { url: 'blob:cv', contentType: 'application/pdf', fileName: 'jane.pdf', fileId: 9 };

describe('CvPreviewDialog download', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads through the candidate endpoint by default', async () => {
    render(<CvPreviewDialog candidateId={42} preview={preview} onClose={vi.fn()} />);

    await userEvent.click(screen.getAllByRole('button', { name: /Download/ })[0]);

    expect(downloadCvFile).toHaveBeenCalledWith(42, 9, false);
  });

  it('downloads through the grant-checked shared endpoint in shared mode', async () => {
    render(<CvPreviewDialog candidateId={42} preview={preview} onClose={vi.fn()} shared />);

    await userEvent.click(screen.getAllByRole('button', { name: /Download/ })[0]);

    expect(downloadCvFile).toHaveBeenCalledWith(42, 9, true);
  });
});
