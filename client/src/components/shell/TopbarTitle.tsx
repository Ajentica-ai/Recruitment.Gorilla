import { useLocation } from 'react-router-dom';
import { routeFor } from '../../navRoutes';

/**
 * The topbar heading — the current page, not the product name. Because this
 * owns the page title, pages no longer render their own <h2> heading.
 *
 * Mirrors Prism's TopbarTitle: [icon] Title, with a one-line description
 * beneath.
 */
export default function TopbarTitle() {
  const { pathname } = useLocation();
  const route = routeFor(pathname);
  const Icon = route?.icon;

  return (
    <div className="app-topbar__title-group">
      <div className="app-topbar__title-row">
        {Icon && <Icon size={16} strokeWidth={1.75} className="app-topbar__icon" aria-hidden="true" />}
        <h1 className="app-topbar__title">{route?.label ?? 'Recruitment Gorilla'}</h1>
      </div>
      {route?.description && (
        <span className="app-topbar__description hidden sm:block">{route.description}</span>
      )}
    </div>
  );
}
