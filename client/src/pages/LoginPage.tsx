import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';

import BrandLogo from '@/components/BrandLogo';
import ThemeMenu from '@/components/ThemeMenu';
import PasswordInput from '@/components/common/PasswordInput';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldStack } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/auth/AuthContext';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? '/candidates';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login({ email: email.trim(), password });
      navigate(user.mustChangePassword ? '/change-password' : from, { replace: true });
    } catch (err) {
      setError(
        isAxiosError(err) && err.response?.status === 401
          ? 'Invalid email or password.'
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center content-center bg-background p-6">
      {/* The one card in the app that floats on an otherwise empty page, so it
          takes dialog-level elevation rather than the resting card shadow. */}
      <div className="relative w-full max-w-[26rem] rounded-[var(--radius-2xl)] border border-border bg-card px-8 py-10 shadow-[var(--shadow-lg)]">
        <ThemeMenu className="absolute top-3 right-3" />

        <BrandLogo layout="stacked" size={68} className="mb-6 w-full justify-center" title="Recruitment Gorilla" />
        <h1 className="mb-6 text-center text-[length:var(--text-2xl)] font-bold tracking-[var(--tracking-display)]">
          Sign in
        </h1>

        <form onSubmit={handleSubmit}>
          <FieldStack>
            {error && <Alert variant="danger">{error}</Alert>}

            <Field label="Email" required>
              {(field) => (
                <Input
                  {...field}
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              )}
            </Field>

            <Field label="Password" required>
              {(field) => (
                <PasswordInput
                  {...field}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              )}
            </Field>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </FieldStack>
        </form>
      </div>
    </div>
  );
}
