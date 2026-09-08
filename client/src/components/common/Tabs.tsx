export interface TabDef {
  id: string;
  label: string;
}

/** Underline tab strip, on Prism's `.admin-tabs`. Scrolls horizontally when narrow.
 *  Pair it with `useTabs` from ./useTabs to keep the active tab in the URL. */
export default function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="admin-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          className={active === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The panel a tab controls. Kept next to Tabs so the aria wiring stays in one
 * place.
 *
 * The panel is itself a page stack: a tab's contents are sections like any
 * other page's, so they get the same rhythm rather than each tab inventing its
 * own spacing.
 */
export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="page-stack">
      {children}
    </div>
  );
}
