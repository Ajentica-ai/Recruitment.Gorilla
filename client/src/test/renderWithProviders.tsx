import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ToastStack';

/**
 * Wraps a component in the providers most pages/components need: React Query, toasts, router.
 * Also returns the `queryClient` it created, so a test can spy on `invalidateQueries` to assert a
 * mutation invalidates the keys it's supposed to, without needing a second component mounted to
 * observe a refetch.
 */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
