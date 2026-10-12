import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchableDropdown, {
  SearchableMultiSelect,
} from './SearchableSelect';

describe('SearchableDropdown', () => {
  const sampleOptions = [
    { id: 1, name: 'React', subtitle: 'Frontend library' },
    { id: 2, name: 'TypeScript', subtitle: 'Typed JavaScript', badge: 'Popular' },
    { id: 3, name: 'C# / .NET', subtitle: 'Backend framework' },
    { id: 4, name: 'MySQL', subtitle: 'Relational database', disabled: true },
    { id: 5, name: 'PostgreSQL', subtitle: 'SQL database' },
  ];

  it('renders placeholder and opens menu on click', () => {
    render(
      <SearchableDropdown
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
        placeholder="Choose a technology..."
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('placeholder', 'Choose a technology...');

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Typed JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('filters options by typing directly in the input', () => {
    render(
      <SearchableDropdown
        options={sampleOptions}
        value={null}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'typed' } });

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('calls onChange with selected option id on click', () => {
    const handleChange = vi.fn();
    render(
      <SearchableDropdown
        options={sampleOptions}
        value={null}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText('TypeScript'));

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('navigates with keyboard ArrowDown and selects with Enter', () => {
    const handleChange = vi.fn();
    render(
      <SearchableDropdown
        options={sampleOptions}
        value={null}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('supports multi-select mode and displays count', () => {
    const handleChange = vi.fn();
    render(
      <SearchableMultiSelect
        options={sampleOptions}
        value={[1, 2]}
        onChange={handleChange}
        placeholder="Filter by skills..."
      />
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('2 skills selected');
  });

  it('names the actual item type when itemNoun is given, not "skills"', () => {
    render(
      <SearchableMultiSelect
        options={sampleOptions}
        value={[1, 2]}
        onChange={vi.fn()}
        placeholder="Search users to assign…"
        itemNoun="interviewers"
      />
    );

    expect(screen.getByRole('combobox')).toHaveValue('2 interviewers selected');
  });
});
