import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface Option<T = number | string> {
  id: T;
  name: string;
  label?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean;
}

export type DropdownOption<T = number | string> = Option<T>;

export interface SearchableDropdownProps<T = number | string> {
  options: Option<T>[];
  value: T | null | T[];
  onChange: (val: any) => void;
  multiple?: boolean;
  showTokens?: boolean;
  placeholder?: string;
  id?: string;
  isInvalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  emptyMessage?: string;
  renderOption?: (option: Option<T>, isSelected: boolean) => React.ReactNode;
}

export default function SearchableDropdown<T = number | string>({
  options,
  value,
  onChange,
  multiple = false,
  showTokens = true,
  placeholder = 'Select an option...',
  id: customId,
  isInvalid = false,
  disabled = false,
  clearable = true,
  size = 'md',
  className = '',
  emptyMessage = 'No matches found',
  renderOption,
}: SearchableDropdownProps<T>) {
  const autoId = useId();
  const inputId = customId || autoId;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Normalise selected values
  const selectedValues = useMemo<T[]>(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value !== null && value !== undefined ? [value as T] : [];
  }, [value, multiple]);

  const selectedOptions = useMemo(() => {
    return options.filter((o) => selectedValues.includes(o.id));
  }, [options, selectedValues]);

  // Filter options based on direct input query
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const matchName = o.name.toLowerCase().includes(q);
      const matchLabel = o.label ? o.label.toLowerCase().includes(q) : false;
      const matchSubtitle = o.subtitle ? o.subtitle.toLowerCase().includes(q) : false;
      return matchName || matchLabel || matchSubtitle;
    });
  }, [options, query]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const items = listRef.current.querySelectorAll('.dropdown-popover__item');
      if (items[highlightedIndex] && typeof items[highlightedIndex].scrollIntoView === 'function') {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, open]);

  const handleSelect = (option: Option<T>) => {
    if (option.disabled) return;

    if (multiple) {
      const exists = selectedValues.includes(option.id);
      const next = exists
        ? selectedValues.filter((v) => v !== option.id)
        : [...selectedValues, option.id];
      onChange(next);
      setQuery('');
      inputRef.current?.focus();
    } else {
      onChange(option.id);
      setOpen(false);
      setQuery('');
    }
  };

  const handleRemove = (idToRemove: T, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== idToRemove));
    } else {
      onChange(null);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : null);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setOpen(false);
        setQuery('');
        break;
      default:
        break;
    }
  };

  const singleSelectedOption = !multiple && selectedOptions.length > 0 ? selectedOptions[0] : null;

  // Display value for input
  const getInputValue = () => {
    if (open) return query;
    if (multiple) {
      if (selectedOptions.length === 0) return '';
      if (selectedOptions.length === 1) return selectedOptions[0].name;
      return `${selectedOptions.length} skills selected`;
    }
    return singleSelectedOption ? singleSelectedOption.name : '';
  };

  return (
    <div
      ref={containerRef}
      className={`dropdown-custom-root relative ${className}`.trim()}
      onKeyDown={handleKeyDown}
    >
      {/* Multi-select tokens (when enabled for form / dialog modes) */}
      {multiple && showTokens && selectedOptions.length > 0 && (
        <div className="dropdown-token-group mb-1.5">
          {selectedOptions.map((o) => (
            <span key={String(o.id)} className="dropdown-token">
              {o.color && (
                <span
                  className="dropdown-token__dot"
                  style={{ backgroundColor: o.color }}
                />
              )}
              <span className="dropdown-token__text">{o.name}</span>
              {!disabled && (
                <button
                  type="button"
                  className="dropdown-token__remove"
                  aria-label={`Remove ${o.name}`}
                  onClick={(e) => handleRemove(o.id, e)}
                >
                  <X size={11} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Main Direct-Search Input Trigger */}
      <div className="relative flex items-center">
        {/* Leading colored dot for single-select */}
        {!open && singleSelectedOption?.color && (
          <span
            className="dropdown-dot absolute pointer-events-none"
            style={{
              left: 10,
              width: 7,
              height: 7,
              backgroundColor: singleSelectedOption.color,
              boxShadow: `0 0 5px ${singleSelectedOption.color}50`,
              zIndex: 3,
            }}
          />
        )}

        <Input
          ref={inputRef}
          id={inputId}
          autoComplete="off"
          disabled={disabled}
          placeholder={open && singleSelectedOption ? singleSelectedOption.name : placeholder}
          value={getInputValue()}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setQuery('');
            }
          }}
          onClick={() => {
            if (!disabled) {
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          aria-invalid={isInvalid || undefined}
          className={cn(
            'dropdown-trigger-input',
            open && 'dropdown-trigger-input--open',
            size === 'sm' && 'h-[var(--control-h-sm)] text-[length:var(--text-sm)]',
            size === 'lg' && 'h-[var(--control-h-lg)]',
          )}
          style={{
            paddingLeft: !open && singleSelectedOption?.color ? '23px' : '11px',
            paddingRight: '2rem',
          }}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${inputId}-menu`}
        />

        <div className="dropdown-trigger-actions absolute end-0 me-2.5 flex items-center pointer-events-none">
          <ChevronDown
            size={14}
            className={`dropdown-chevron text-muted-foreground ${
              open ? 'dropdown-chevron--rotated text-primary' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Floating Popover Menu (Direct options list only) */}
      {open && (
        <div
          id={`${inputId}-menu`}
          ref={listRef}
          className="dropdown-popover-menu"
          role="listbox"
          aria-label={placeholder}
        >
          <div className="dropdown-popover__list">
            {/* "All" reset option for single select when clearable */}
            {clearable && !multiple && !query && (
              <button
                type="button"
                className={`dropdown-popover__item ${
                  !singleSelectedOption ? 'dropdown-popover__item--selected' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleClear(e);
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="dropdown-dot"
                    style={{ backgroundColor: 'var(--text-muted, #94a3b8)', opacity: 0.5 }}
                  />
                  <span className="dropdown-popover__item-name text-muted-foreground">
                    {placeholder.startsWith('All') ? placeholder : `All (${placeholder})`}
                  </span>
                </div>
                {!singleSelectedOption && (
                  <Check size={14} className="text-brand ml-1 shrink-0" strokeWidth={2.5} />
                )}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="dropdown-popover__empty">
                <Search size={15} className="dropdown-popover__empty-icon" />
                <span>{emptyMessage}</span>
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = selectedValues.includes(option.id);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    type="button"
                    key={String(option.id)}
                    disabled={option.disabled}
                    className={`dropdown-popover__item ${
                      isSelected ? 'dropdown-popover__item--selected' : ''
                    } ${isHighlighted ? 'dropdown-popover__item--highlighted' : ''}`.trim()}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(option);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <div className="flex items-center gap-2 truncate mr-2">
                        {option.color && (
                          <span
                            className="dropdown-dot"
                            style={{
                              backgroundColor: option.color,
                              boxShadow: `0 0 6px ${option.color}40`,
                            }}
                          />
                        )}
                        {option.icon && <span className="dropdown-icon">{option.icon}</span>}
                        <div className="truncate">
                          <div className="dropdown-popover__item-name truncate">
                            {option.name}
                          </div>
                          {option.subtitle && (
                            <div className="dropdown-popover__item-subtitle truncate">
                              {option.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      {option.badge && (
                        <span className="dropdown-pill-badge">{option.badge}</span>
                      )}
                      {isSelected && (
                        <Check size={14} className="text-brand ml-1 shrink-0" strokeWidth={2.5} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convenience wrapper for single select (matches legacy signature) */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  id,
  isInvalid,
  disabled,
  clearable = true,
  size,
}: {
  options: Option<number>[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  id?: string;
  isInvalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <SearchableDropdown<number>
      options={options}
      value={value}
      onChange={onChange}
      multiple={false}
      placeholder={placeholder}
      id={id}
      aria-invalid={isInvalid || undefined}
      disabled={disabled}
      clearable={clearable}
      size={size}
    />
  );
}

/** Convenience wrapper for multi select (matches legacy signature) */
export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  id,
  isInvalid,
  disabled,
  clearable = true,
  size,
  showTokens = true,
}: {
  options: Option<number>[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  id?: string;
  isInvalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTokens?: boolean;
}) {
  return (
    <SearchableDropdown<number>
      options={options}
      value={value}
      onChange={onChange}
      multiple={true}
      showTokens={showTokens}
      placeholder={placeholder}
      id={id}
      aria-invalid={isInvalid || undefined}
      disabled={disabled}
      clearable={clearable}
      size={size}
    />
  );
}
