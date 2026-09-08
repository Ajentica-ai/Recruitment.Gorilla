import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../auth/AuthContext';
import { changePassword } from '../services/api';
import Page from '../components/common/Page';
import PasswordInput from '../components/common/PasswordInput';
import SectionCard from '../components/common/SectionCard';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const { mustChangePassword, refresh } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }

    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      // Pull fresh claims (clears must_change_password) before navigating away.
      await refresh();
      navigate('/candidates', { replace: true });
    } catch (err) {
      setError(
        isAxiosError(err) && err.response?.status === 400
          ? 'Current password is incorrect.'
          : 'Unable to change password. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      {/* A single-purpose form, so it gets a measured column rather than the
          full page width — a 1500px-wide password field is not easier to use. */}
      <div className="narrow-column">
        <SectionCard
          as="h2"
          title="Change password"
          description={
            mustChangePassword
              ? undefined
              : 'Choose a password you do not use anywhere else.'
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="form-stack">
              {mustChangePassword && (
                <div className="alert-info-soft">
                  You must set a new password before continuing.
                </div>
              )}
              {error && (
                <div className="alert-danger-soft" role="alert">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">
                  Current password <span className="required-star" aria-hidden="true">*</span>
                </Label>
                <PasswordInput
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">
                  New password <span className="required-star" aria-hidden="true">*</span>
                </Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">At least {MIN_LENGTH} characters.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">
                  Confirm new password <span className="required-star" aria-hidden="true">*</span>
                </Label>
                <PasswordInput
                  id="confirm-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Spinner className="mr-2" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </Page>
  );
}
