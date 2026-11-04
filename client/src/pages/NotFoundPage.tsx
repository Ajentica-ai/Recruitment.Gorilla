import { Link } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

/**
 * The last stop in the route tree, for any path inside the app shell that does not match a real page
 * (#237). RequireRole and each page's own route decide what IS reachable; this only covers what is
 * not — a mistyped address or a stale link. It used to render nothing at all: no sidebar, no message,
 * just a blank page, for every role and signed out too.
 */
export default function NotFoundPage() {
  return (
    <EmptyState
      page
      title="Page not found"
      description="This page doesn't exist, or the link may be out of date."
      action={
        <Button asChild variant="outline">
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
