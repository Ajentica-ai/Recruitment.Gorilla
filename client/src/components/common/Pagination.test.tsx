import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

describe('Pagination page size', () => {
  const setup = (onPageSizeChange = vi.fn()) => {
    render(
      <Pagination
        page={1}
        pageSize={10}
        totalCount={40}
        noun="candidate"
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    return onPageSizeChange;
  };

  it('shows the current page size in the control', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'candidates per page' })).toHaveTextContent('10');
  });

  it('calls onPageSizeChange with a number when another size is picked', async () => {
    const onPageSizeChange = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'candidates per page' }));
    await user.click(await screen.findByRole('option', { name: '25' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('renders the options as an in-page listbox, not a native select', async () => {
    setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'candidates per page' }));

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
  });
});
