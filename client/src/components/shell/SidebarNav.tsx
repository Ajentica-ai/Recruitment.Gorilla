import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightFromLine, LoaderCircle, PanelLeftClose, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import BrandLogo from '../BrandLogo';
import { canSeeRoute, groupedRoutes, isRouteActive, NAV_ROUTES } from '../../navRoutes';
import { getCandidateDrafts } from '../../services/api';

type SidebarNavProps = {
  isVisible: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onHide: () => void;
};

/**
 * The primary navigation: brand + collapse control, then the route list.
 *
 * The footer that used to sit below the list (theme toggle + the signed-in
 * user's card) moved to the topbar — see ThemeMenu and UserMenu. It held no
 * navigation, yet on a collapsed 64px rail it was one of the first things the
 * eye landed on, and account controls belong with the other chrome.
 */
export default function SidebarNav({
  isVisible,
  isCollapsed,
  onToggleCollapse,
  onHide,
}: SidebarNavProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const roles = user?.roles ?? [];
  const groups = groupedRoutes(roles);

  /**
   * The count on Upload CVs. Only fetched for someone who can actually see
   * that item — otherwise it is a request whose answer is never rendered, and
   * on this API it would 403 anyway.
   *
   * pageSize 1 because only the totals are wanted; the endpoint returns them
   * alongside whatever page you ask for, so this is the cheapest call that
   * carries them.
   */
  const uploadRoute = NAV_ROUTES.find((r) => r.badge === 'pending-drafts');
  const canSeeDrafts = !!uploadRoute && canSeeRoute(uploadRoute, roles);
  const { data: draftTotals } = useQuery({
    queryKey: ['candidate-drafts', 'sidebar-count'],
    queryFn: () => getCandidateDrafts({ status: 'Pending', pageSize: 1 }),
    enabled: canSeeDrafts,
    staleTime: 60_000,
  });
  const pendingDrafts = draftTotals?.totalPending ?? 0;

  // Clear the pending spinner once the route has actually changed.
  useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  const handleNavClick = (path: string) => {
    if (!isRouteActive(location.pathname, path)) setPendingPath(path);
    // On mobile the sidebar is a drawer over the content — close it on pick.
    if (typeof window !== 'undefined' && window.innerWidth < 768) onHide();
  };

  const className = [
    'app-sidebar',
    !isVisible && 'app-sidebar--hidden',
    isCollapsed && 'app-sidebar--collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={className} aria-hidden={!isVisible}>
      <div className="app-sidebar__head">
        {isCollapsed ? (
          <button
            type="button"
            className="app-sidebar__expand"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <BrandLogo layout="mark" size={30} />
            <span className="app-sidebar__expand-icon" aria-hidden="true">
              <ArrowRightFromLine size={16} strokeWidth={1.5} />
            </span>
          </button>
        ) : (
          <>
            <Link to="/" className="app-sidebar__brand">
              <BrandLogo layout="horizontal" size={32} title="Recruitment Gorilla" />
            </Link>
            <button
              type="button"
              className="app-sidebar__icon-btn app-sidebar__collapse-btn hidden md:inline-grid"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="app-sidebar__icon-btn app-sidebar__collapse-btn inline-grid md:hidden"
              onClick={onHide}
              aria-label="Close navigation"
              title="Close navigation"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      <nav className="app-sidebar__nav" aria-label="Primary">
        {groups.map(({ group, routes }) => (
          // A <ul> per band, labelled by its heading, so the grouping is in the
          // accessibility tree and not only in the picture.
          <div className="app-sidebar__group" key={group}>
            {/* Collapsed to a 56px rail the heading has nowhere to go, so the
                band is drawn as a rule instead — see .app-sidebar__group in
                index.css. The label stays in the DOM for screen readers. */}
            <p className="app-sidebar__group-label" aria-hidden={isCollapsed}>
              {group}
            </p>
            <ul className="app-sidebar__group-list" aria-label={group}>
              {routes.map((route) => {
                // NavLink appends the `active` class itself; isRouteActive is
                // only used to decide whether a click is a real navigation
                // worth spinning.
                const Icon = pendingPath === route.path ? LoaderCircle : route.icon;
                const count = route.badge === 'pending-drafts' ? pendingDrafts : undefined;
                return (
                  <li key={route.path}>
                    <NavLink
                      to={route.path}
                      end={route.path === '/'}
                      className="nav-item-link"
                      title={route.label}
                      onClick={() => handleNavClick(route.path)}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className={pendingPath === route.path ? 'anim-spin' : undefined}
                      />
                      {!isCollapsed && route.label}
                      {!isCollapsed && !!count && (
                        <span className="nav-item-link__count">
                          {count > 999 ? '999+' : count}
                          <span className="sr-only"> pending</span>
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
