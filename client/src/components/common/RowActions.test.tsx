import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RowActions, { RowAction } from './RowActions';

describe('RowActions', () => {
  it('opens its menu beside the trigger, on the same row, never above or below it', async () => {
    const user = userEvent.setup();
    render(
      <RowActions label="Actions for Ada">
        <RowAction onClick={vi.fn()}>Delete candidate</RowAction>
      </RowActions>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }));
    await screen.findByRole('menuitem', { name: 'Delete candidate' });

    // Above or below, the menu floats over a neighbouring candidate's row (#65, #66).
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toHaveAttribute('data-side', 'left');
  });

  it('runs the action when an item is chosen', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RowActions label="Actions for Ada">
        <RowAction onClick={onClick}>Delete candidate</RowAction>
      </RowActions>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete candidate' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
