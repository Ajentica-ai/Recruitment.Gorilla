import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import type { Role } from './types';

/**
 * The bands the sidebar is divided into, in the order they appear. Seven flat
 * items gave no clue that Audit and Users are administration while Upload and
 * Candidates are the daily work; three short headings say it without costing a
 * click.
 */
export const NAV_GROUPS = ['Overview', 'Pipeline', 'Admin'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavRoute = {
  /** Route path. Prefix-matched, so /candidates/7 resolves to the Candidates entry. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** One line shown under the title in the topbar. */
  description: string;
  /** Roles that may see the item. `undefined` means every authenticated user. */
  roles?: Role[];
  /** Reachable but not listed in the sidebar (deep links, self-service pages). */
  hidden?: boolean;
  /** Which band of the sidebar it belongs to. Hidden routes need none. */
  group?: NavGroup;
  /**
   * A live count rendered at the end of the item. Named rather than passed as a
   * number so this file stays a static description of the nav and the sidebar
   * owns the fetching.
   */
  badge?: 'pending-drafts';
};

/**
 * Single source of truth for the portal's routes — the sidebar renders from
 * this, and the topbar reads the title/description off it. Mirrors Prism's
 * lib/navRoutes.ts.
 *
 * The `roles` here duplicate the `RequireRole` guards in App.tsx on purpose:
 * these decide what is *shown*, those decide what is *reachable*. A missing
 * guard must never be covered for by a hidden nav item.
 *
 * Labels are load-bearing — e2e/smoke.spec.ts finds the nav by accessible name
 * ("Candidates"), so renaming one is a test change too.
 */
export const NAV_ROUTES: NavRoute[] = [
  {
    path: '/',
    label: 'Dashboard',
    group: 'Overview',
    icon: LayoutDashboard,
    description: 'Pipeline health, upcoming interviews and recent activity at a glance.',
  },
  {
    path: '/analytics',
    label: 'Analytics',
    group: 'Overview',
    icon: BarChart3,
    description: 'Pipeline velocity, time-to-hire, funnel conversion and sourcing ROI.',
    roles: ['SuperAdmin', 'Admin', 'Recruiter'],
  },
  {
    path: '/jobs',
    label: 'Jobs',
    group: 'Pipeline',
    icon: Briefcase,
    description: 'Track open positions, target dates, required skills, and assigned recruiters.',
    roles: ['SuperAdmin', 'Admin', 'Recruiter'],
  },
  {
    path: '/upload',
    label: 'Upload CVs',
    group: 'Pipeline',
    badge: 'pending-drafts',
    icon: Upload,
    description: 'Drop CVs in bulk, review what was extracted, and add candidates.',
    roles: ['SuperAdmin', 'Admin', 'Recruiter'],
  },
  {
    path: '/candidates',
    label: 'Candidates',
    group: 'Pipeline',
    icon: Users,
    description: 'Search, filter and manage every candidate in the pipeline.',
    roles: ['SuperAdmin', 'Admin', 'Recruiter'],
  },
  {
    path: '/configuration',
    label: 'Configuration',
    group: 'Admin',
    icon: Settings,
    description: 'Evaluation rubrics, skills, interview types and email settings.',
    roles: ['SuperAdmin', 'Admin'],
  },
  {
    path: '/audit',
    label: 'Audit',
    group: 'Admin',
    icon: ScrollText,
    description: 'Who changed what, and when.',
    roles: ['SuperAdmin', 'Admin'],
  },
  {
    path: '/users',
    label: 'Users',
    group: 'Admin',
    icon: UserCog,
    description: 'Accounts, roles and password resets.',
    roles: ['SuperAdmin'],
  },
  {
    path: '/interviews',
    label: 'Interview',
    icon: CalendarCheck,
    description: 'Review the candidate and record your evaluation.',
    hidden: true,
  },
  {
    path: '/change-password',
    label: 'Change password',
    icon: KeyRound,
    description: 'Set a new password for your account.',
    hidden: true,
  },
];

/**
 * The route matching a pathname, or undefined. Longest-prefix wins so
 * /candidates/7 maps to Candidates rather than to the "/" root entry.
 */
export function routeFor(pathname: string): NavRoute | undefined {
  if (pathname === '/') return NAV_ROUTES[0];
  return NAV_ROUTES.filter(
    (r) => r.path !== '/' && (pathname === r.path || pathname.startsWith(`${r.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

/** Whether a nav item should render for the given roles. */
export function canSeeRoute(route: NavRoute, roles: Role[]): boolean {
  if (route.hidden) return false;
  if (!route.roles) return true;
  return route.roles.some((r) => roles.includes(r));
}

/** The sidebar's items for a set of roles, in declaration order. */
export function visibleRoutes(roles: Role[]): NavRoute[] {
  return NAV_ROUTES.filter((r) => canSeeRoute(r, roles));
}

/**
 * The sidebar's items bucketed by group, in NAV_GROUPS order, with empty
 * groups dropped — a Recruiter sees no Admin band rather than an empty heading.
 */
export function groupedRoutes(roles: Role[]): { group: NavGroup; routes: NavRoute[] }[] {
  const visible = visibleRoutes(roles);
  return NAV_GROUPS.map((group) => ({
    group,
    routes: visible.filter((r) => r.group === group),
  })).filter((g) => g.routes.length > 0);
}

/** True when `pathname` is inside `route` — drives the active nav highlight. */
export function isRouteActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
