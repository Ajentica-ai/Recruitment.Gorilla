import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type ThemePreference } from '@/theme/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Theme picker: Light / Dark / System.
 *
 * A menu rather than the sun-moon toggle this replaces, because a two-state
 * toggle cannot express "follow the OS" — and the stored value used to be the
 * *resolved* theme, so the moment you touched the toggle you were pinned to a
 * fixed mode forever with no way back to automatic.
 *
 * The trigger shows the icon of what is currently *painted* (so it reads as a
 * status), while the tick marks the chosen preference — which is `System` even
 * when that currently resolves to dark.
 *
 * A radio group, not three buttons: these are three values of one setting, and
 * Radix then gives the group arrow-key roving and announces the selected one.
 * It also closes on select, which the previous implementation had to manage by
 * hand with a controlled `open` because react-bootstrap only auto-closed for
 * its own `Dropdown.Item`.
 */
export default function ThemeMenu({ className = '' }: { className?: string }) {
  const { preference, theme, setPreference } = useTheme();
  const TriggerIcon = theme === 'dark' ? Moon : Sun;
  const current = OPTIONS.find((o) => o.value === preference);
  const label = `Theme: ${current?.label ?? 'System'}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className={className} aria-label={label} title={label}>
          <TriggerIcon strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
        >
          {OPTIONS.map(({ value, label: optionLabel, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
