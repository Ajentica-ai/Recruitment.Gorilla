import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Self-hosted Plus Jakarta Sans — the family the design tokens name. Must load
// before index.css so --font-body resolves to a family that is actually present.
import '@fontsource-variable/plus-jakarta-sans';
// The single CSS entry point. theme.css imports bootstrap, index.css and
// Tailwind into explicit cascade layers — see the note at the top of it for
// why the order matters and why they can't be imported separately here.
import './styles/theme.css';
import App from './App.tsx';
import { ThemeProvider } from './theme/ThemeContext.tsx';
import { ToastProvider } from './components/ToastStack.tsx';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
