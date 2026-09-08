import { describe, expect, it } from 'vitest';
import { isRouteActive, routeFor, visibleRoutes } from './navRoutes';
import type { Role } from './types';

/**
 * These cover the role gating that moved out of App.tsx's hardcoded <Nav.Link>
 * list when the top navbar became the sidebar. They are about what the sidebar
 * *shows*; RequireRole in App.tsx still decides what is reachable.
 */
describe('visibleRoutes', () => {
  const labels = (roles: Role[]) => visibleRoutes(roles).map((r) => r.label);

  it('shows an Interviewer only the Dashboard', () => {
    expect(labels(['Interviewer'])).toEqual(['Dashboard']);
  });

  it('shows a Recruiter the candidate-managing pages but no admin pages', () => {
    expect(labels(['Recruiter'])).toEqual(['Dashboard', 'Analytics', 'Jobs', 'Upload CVs', 'Candidates']);
  });

  it('shows an Admin the config and audit pages but not Users', () => {
    expect(labels(['Admin'])).toEqual([
      'Dashboard',
      'Analytics',
      'Jobs',
      'Upload CVs',
      'Candidates',
      'Configuration',
      'Audit',
    ]);
  });

  it('shows a SuperAdmin everything', () => {
    expect(labels(['SuperAdmin'])).toEqual([
      'Dashboard',
      'Analytics',
      'Jobs',
      'Upload CVs',
      'Candidates',
      'Configuration',
      'Audit',
      'Users',
    ]);
  });

  it('never lists the hidden deep-link routes', () => {
    const all = labels(['SuperAdmin']);
    expect(all).not.toContain('Interview');
    expect(all).not.toContain('Change password');
  });

  it('gives a user with no roles nothing but the Dashboard', () => {
    expect(labels([])).toEqual(['Dashboard']);
  });
});

describe('routeFor', () => {
  it('resolves the root exactly', () => {
    expect(routeFor('/')?.label).toBe('Dashboard');
  });

  it('resolves a nested path to its parent by longest prefix', () => {
    expect(routeFor('/jobs')?.label).toBe('Jobs');
    expect(routeFor('/candidates/7')?.label).toBe('Candidates');
    expect(routeFor('/interviews/12')?.label).toBe('Interview');
  });

  it('returns undefined for an unknown path rather than falling back to the root', () => {
    expect(routeFor('/nope')).toBeUndefined();
  });
});

describe('isRouteActive', () => {
  it('matches the root only exactly, so it does not light up on every page', () => {
    expect(isRouteActive('/', '/')).toBe(true);
    expect(isRouteActive('/candidates', '/')).toBe(false);
  });

  it('matches a section and everything under it', () => {
    expect(isRouteActive('/candidates', '/candidates')).toBe(true);
    expect(isRouteActive('/candidates/7', '/candidates')).toBe(true);
  });

  it('does not match a path that merely shares a prefix', () => {
    expect(isRouteActive('/candidates-archive', '/candidates')).toBe(false);
  });
});
