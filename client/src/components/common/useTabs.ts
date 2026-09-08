import { useSearchParams } from 'react-router-dom';
import type { TabDef } from './Tabs';

/**
 * Tab state held in the query string, so a refresh keeps you where you were and
 * a section can be linked to directly (`/configuration?tab=skills`).
 *
 * Falls back to the first tab when the param is missing or names something that
 * isn't a tab — a stale bookmark should land somewhere sensible, not on a blank
 * panel. `replace` so flipping tabs doesn't fill the back button with history.
 *
 * Lives apart from Tabs.tsx only to keep that file components-only, which is
 * what React Fast Refresh needs.
 */
export function useTabs(tabs: TabDef[], param = 'tab'): [string, (id: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(param);
  const active = tabs.some((t) => t.id === requested) ? requested! : tabs[0].id;

  const setActive = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(param, id);
    setSearchParams(next, { replace: true });
  };

  return [active, setActive];
}
