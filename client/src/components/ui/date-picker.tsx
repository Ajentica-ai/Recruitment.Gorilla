import { CalendarDays, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A date (or date + time) field: type it, or pick it.
 *
 * Both halves matter. The native `<input type="date">` this replaces looked
 * like browser chrome rather than part of the app, but it was genuinely good
 * at one thing — someone who knows the date just types it. A picker that only
 * accepts clicks is slower for that person, so the text field here stays a
 * real text field and the calendar is an optional affordance beside it.
 *
 * The value is exchanged in the same format the native input used —
 * `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` — so every call site keeps working
 * unchanged, including the ones that hand the string straight to the API.
 */

/** Local (not UTC) parts, because a date field means a date where you are. */
function toLocalValue(d: Date, withTime: boolean) {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${date}T${p(d.getHours())}:${p(d.getMinutes())}` : date;
}

function parseValue(value: string): Date | undefined {
  if (!value) return undefined;
  // `new Date('2026-09-03')` is parsed as UTC and can land on the previous day
  // west of Greenwich, so the parts are read out explicitly.
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
  if (!m) return undefined;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0,
  );
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Include a time field, replacing `type="datetime-local"`. */
  withTime?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
}

export function DatePicker({
  value,
  onChange,
  withTime = false,
  id,
  placeholder,
  disabled,
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseValue(value);

  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : '';

  const setDate = (next: string) => {
    if (!next) return onChange('');
    onChange(withTime ? `${next}T${timePart || '00:00'}` : next);
  };

  const setTime = (next: string) => {
    const day = datePart || toLocalValue(new Date(), false);
    onChange(next ? `${day}T${next}` : day);
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <div className="relative min-w-0 flex-1">
        <Input
          id={id}
          type="date"
          value={datePart}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setDate(e.target.value)}
          // The browser's own calendar button is suppressed in index.css; this
          // field keeps the typing and the date validation, and the picker
          // below supplies the visual calendar.
          className="date-field min-w-[8.5rem] pr-8"
          {...aria}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              disabled={disabled}
              aria-label="Open calendar"
              className="absolute top-1/2 right-1 -translate-y-1/2"
            >
              <CalendarDays />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                if (d) setDate(toLocalValue(d, false));
                setOpen(false);
              }}
              autoFocus
            />
            <div className="flex items-center justify-between border-t border-border p-2">
              <Button variant="ghost" size="sm" onClick={() => { onChange(''); setOpen(false); }}>
                <X />
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDate(toLocalValue(new Date(), false)); setOpen(false); }}
              >
                Today
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {withTime && (
        <Input
          type="time"
          aria-label="Time"
          value={timePart}
          disabled={disabled}
          onChange={(e) => setTime(e.target.value)}
          className="date-field w-[7.5rem] shrink-0"
        />
      )}
    </div>
  );
}
