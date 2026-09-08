import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { KeyRound, Pencil, UserCheck, UserCog, UserPlus, UserX } from 'lucide-react';
import {
  createUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from '../services/api';
import { useToast } from '../components/ToastStack';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import Page from '../components/common/Page';
import PageHeader from '../components/common/PageHeader';
import RowActions, { RowAction } from '../components/common/RowActions';
import { SkeletonRows } from '../components/common/Loading';
import { ALL_ROLES, type Role, type UserListItem } from '../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/field';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Roles as pill badges rather than raw Bootstrap `<Badge bg="…">`, which
 * ignored the pill geometry used everywhere else and coloured SuperAdmin
 * `danger` — the hue this app reserves for destructive actions and failures,
 * which made the most senior account look like an error. Seniority is now
 * conveyed by fill weight (accent → outline), not by a warning colour.
 */
const roleBadge: Record<Role, BadgeVariant> = {
  SuperAdmin: 'brand',
  Admin: 'brand',
  Recruiter: 'outline',
  Interviewer: 'outline',
};

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return fallback;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function UsersPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return updateUser(editing.id, { name: name.trim(), roles, isActive });
      }
      return createUser({
        name: name.trim(),
        email: email.trim(),
        roles,
        temporaryPassword,
      });
    },
    onSuccess: () => {
      void invalidate();
      addToast(editing ? 'User updated.' : 'User created.');
      setShowEdit(false);
    },
    onError: (err) =>
      setFormError(errorMessage(err, editing ? 'Could not update user.' : 'Could not create user.')),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetUserPassword(resetTarget!.id, { temporaryPassword: resetPassword }),
    onSuccess: () => {
      void invalidate();
      addToast('Temporary password set. The user must change it on next login.');
      setResetTarget(null);
    },
    onError: (err) => setResetError(errorMessage(err, 'Could not reset password.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (u: UserListItem) =>
      updateUser(u.id, { name: u.name, roles: u.roles, isActive: !u.isActive }),
    onSuccess: (_data, u) => {
      void invalidate();
      addToast(u.isActive ? 'User deactivated.' : 'User activated.');
    },
    onError: (err) => addToast(errorMessage(err, 'Could not update user.'), 'danger'),
  });

  const openAdd = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setRoles([]);
    setIsActive(true);
    setTemporaryPassword('');
    setFormError(null);
    setShowEdit(true);
  };

  const openEdit = (u: UserListItem) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setRoles(u.roles);
    setIsActive(u.isActive);
    setTemporaryPassword('');
    setFormError(null);
    setShowEdit(true);
  };

  const openReset = (u: UserListItem) => {
    setResetTarget(u);
    setResetPassword('');
    setResetError(null);
  };

  const toggleRole = (role: Role) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!editing && !email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (roles.length === 0) {
      setFormError('Select at least one role.');
      return;
    }
    if (!editing && temporaryPassword.length < 8) {
      setFormError('Temporary password must be at least 8 characters.');
      return;
    }
    saveMutation.mutate();
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (resetPassword.length < 8) {
      setResetError('Temporary password must be at least 8 characters.');
      return;
    }
    resetMutation.mutate();
  };

  return (
    <Page>
      {/* No <h2> — the topbar owns the page title. This page has no filter
          bar for the action to share a row with, so it keeps a header. */}
      <PageHeader
        actions={
          <Button onClick={openAdd}>
            <UserPlus size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="ml-1">Add user</span>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonRows rows={5} label="Loading users" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserCog size={20} strokeWidth={1.75} aria-hidden="true" />}
          title="No users yet"
          description="Add an account to give someone access to the portal."
          action={<Button onClick={openAdd}>Add user</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table table-cards align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 180 }}>Last login</th>
                {/* Was 300px, to fit three full-width buttons. That is what
                    pushed this table past the viewport and put a horizontal
                    scrollbar on the page — the "Add user" button in the header
                    was clipped off the right edge as a result. One overflow
                    trigger needs 52. */}
                <th className="col-actions" style={{ width: 52 }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">
                    <div className="cell-identity">
                      <Avatar name={u.name} email={u.email} />
                      <span className="cell-identity__text">
                        <span className="cell-identity__name">{u.name}</span>
                        {/* Demoted from a warning badge to a caption. It is a
                            fact about the account, not a problem needing
                            attention, and a yellow pill beside a name reads as
                            the latter. */}
                        {u.mustChangePassword && (
                          <span className="cell-identity__meta">Must change password</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td data-label="Email" className="[overflow-wrap:anywhere]">{u.email}</td>
                  <td data-label="Roles">
                    <span className="badge-row">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={roleBadge[r]}>
                          {r}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td data-label="Status">
                    <Badge variant={u.isActive ? 'success' : 'neutral'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td data-label="Last login" className="table-muted">{formatDate(u.lastLoginAt)}</td>
                  <td className="col-actions">
                    <RowActions label={`Actions for ${u.name}`}>
                      <RowAction
                        icon={<Pencil size={15} strokeWidth={1.75} aria-hidden="true" />}
                        onClick={() => openEdit(u)}
                      >
                        Edit user
                      </RowAction>
                      <RowAction
                        icon={<KeyRound size={15} strokeWidth={1.75} aria-hidden="true" />}
                        onClick={() => openReset(u)}
                      >
                        Reset password
                      </RowAction>
                      <div className="menu-panel__divider" />
                      <RowAction
                        icon={
                          u.isActive
                            ? <UserX size={15} strokeWidth={1.75} aria-hidden="true" />
                            : <UserCheck size={15} strokeWidth={1.75} aria-hidden="true" />
                        }
                        tone={u.isActive ? 'danger' : 'default'}
                        disabled={toggleActiveMutation.isPending}
                        onClick={() => toggleActiveMutation.mutate(u)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </RowAction>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit modal */}
      <Dialog open={showEdit} onOpenChange={(open) => { if (!open) { (() => setShowEdit(false))(); } }}>
<DialogContent>
        <form onSubmit={submitForm}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="form-stack">
              {formError && (
                <div className="alert-danger-soft" role="alert">
                  {formError}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Name <span className="required-star" aria-hidden="true">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email <span className="required-star" aria-hidden="true">*</span></Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editing}
                />
                {editing && <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">Email can't be changed.</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <legend className="text-[length:var(--text-sm)] font-semibold text-text-soft">
                  Roles <span className="required-star" aria-hidden="true">*</span>
                </legend>
                <div className="check-grid">
                  {ALL_ROLES.map((r) => (
                    <CheckboxField key={r} id={`role-${r}`} label={r} checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                  ))}
                </div>
              </div>
              {!editing && (
                <div className="flex flex-col gap-1.5">
                  <Label>Temporary password <span className="required-star" aria-hidden="true">*</span></Label>
                  <Input
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">
                    At least 8 characters. The user must change it on first login.
                  </p>
                </div>
              )}
              {editing && (
                <CheckboxField id="user-active" label="Active — can sign in" checked={isActive} onCheckedChange={(checked) => setIsActive(checked)} />
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
</Dialog>

      {/* Reset password modal */}
      <Dialog open={resetTarget !== null} onOpenChange={(open) => { if (!open) { (() => setResetTarget(null))(); } }}>
<DialogContent>
        <form onSubmit={submitReset}>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="form-stack">
              {resetError && (
                <div className="alert-danger-soft" role="alert">
                  {resetError}
                </div>
              )}
              <p className="form-help">
                Set a temporary password for <strong>{resetTarget?.name}</strong>. They'll be required
                to change it on next login.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label>Temporary password <span className="required-star" aria-hidden="true">*</span></Label>
                <Input
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-muted-foreground">At least 8 characters.</p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Saving…' : 'Reset password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
</Dialog>
    </Page>
  );
}
