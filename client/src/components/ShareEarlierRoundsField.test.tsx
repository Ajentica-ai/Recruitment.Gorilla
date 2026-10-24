import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import ShareEarlierRoundsField from './ShareEarlierRoundsField';
import { getEvaluationShareOptions } from '../services/api';
import type { ShareOptions } from '../types';

vi.mock('../services/api', () => ({ getEvaluationShareOptions: vi.fn() }));

const options = (earlier: number): ShareOptions => ({ interviews: [], users: [], earlierRoundsWithEvaluations: earlier });

const label = "Share earlier rounds' evaluations with this panel";

describe('ShareEarlierRoundsField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is hidden when no earlier round has a submitted evaluation', async () => {
    vi.mocked(getEvaluationShareOptions).mockResolvedValue(options(0));
    renderWithProviders(<ShareEarlierRoundsField candidateId={42} enabled checked={false} onChange={vi.fn()} />);

    await waitFor(() => expect(getEvaluationShareOptions).toHaveBeenCalledWith(42));
    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
  });

  it('is hidden while loading and when the lookup fails', async () => {
    vi.mocked(getEvaluationShareOptions).mockRejectedValue(new Error('boom'));
    renderWithProviders(<ShareEarlierRoundsField candidateId={42} enabled checked={false} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
    await waitFor(() => expect(getEvaluationShareOptions).toHaveBeenCalled());
    expect(screen.queryByLabelText(new RegExp(label))).not.toBeInTheDocument();
  });

  it('asks nothing while the form is closed', () => {
    renderWithProviders(
      <ShareEarlierRoundsField candidateId={42} enabled={false} checked={false} onChange={vi.fn()} />,
    );

    expect(getEvaluationShareOptions).not.toHaveBeenCalled();
  });

  it('shows an unchecked box when there is something to share, and reports a tick', async () => {
    vi.mocked(getEvaluationShareOptions).mockResolvedValue(options(2));
    const onChange = vi.fn();
    renderWithProviders(<ShareEarlierRoundsField candidateId={42} enabled checked={false} onChange={onChange} />);

    const box = await screen.findByRole('checkbox', { name: new RegExp(label) });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the checked state it is given', async () => {
    vi.mocked(getEvaluationShareOptions).mockResolvedValue(options(1));
    renderWithProviders(<ShareEarlierRoundsField candidateId={42} enabled checked onChange={vi.fn()} />);

    expect(await screen.findByRole('checkbox', { name: new RegExp(label) })).toBeChecked();
  });
});
