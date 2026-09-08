import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, X } from 'lucide-react';
import { useToast } from '../../components/ToastStack';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import SectionCard from '../../components/common/SectionCard';
import { Skeleton } from '../../components/common/Loading';
import { skillColorModifier } from '../../utils/skillColors';
import type { DeleteRoleResult, UpsertOptionPayload } from '../../types';
import type { Opt } from './types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckboxField } from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface OptionApi {
  list: (includeInactive: boolean) => Promise<Opt[]>;
  create: (p: UpsertOptionPayload) => Promise<Opt>;
  update: (id: number, p: UpsertOptionPayload) => Promise<Opt>;
  remove: (id: number) => Promise<DeleteRoleResult | void>;
}

/**
 * Skills, candidate sources, and interview types managed as interactive tags/chips.
 * Adding is an ergonomic input bar; clicking a chip opens the edit modal.
 */
export default function OptionChipsTab({
  noun,
  queryKey,
  api,
  addPlaceholder,
  description,
}: {
  /** Lower-case singular, used in toasts and labels ("skill", "interview type"). */
  noun: string;
  queryKey: string;
  api: OptionApi;
  addPlaceholder: string;
  description: string;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Opt | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editInvalid, setEditInvalid] = useState(false);
  const [toDelete, setToDelete] = useState<Opt | null>(null);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['config', queryKey, 'all'],
    queryFn: () => api.list(true),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['config'] });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const createMutation = useMutation({
    mutationFn: (value: string) =>
      api.create({
        name: value,
        sortOrder: (options.at(-1)?.sortOrder ?? 0) + 1,
        isActive: true,
      }),
    onSuccess: () => {
      void invalidate();
      setDraft('');
      addToast(`${cap(noun)} added.`);
    },
    onError: () => addToast(`Could not add that ${noun} — the name may already exist.`, 'danger'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.update(editing!.id, {
        name: editName.trim(),
        sortOrder: editing!.sortOrder,
        isActive: editActive,
      }),
    onSuccess: () => {
      void invalidate();
      setEditing(null);
      addToast(`${cap(noun)} updated.`);
    },
    onError: () => addToast(`Could not update that ${noun} — the name may already exist.`, 'danger'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: (result) => {
      void invalidate();
      setToDelete(null);
      if (result && 'deactivated' in result && result.deactivated) {
        addToast(
          `That ${noun} is in use by ${result.candidateCount} candidate(s) — it was deactivated instead of deleted.`,
          'warning',
        );
      } else {
        addToast(`${cap(noun)} deleted.`);
      }
    },
    onError: () => addToast(`Could not delete that ${noun}.`, 'danger'),
  });

  const submitDraft = () => {
    const value = draft.trim();
    if (!value || createMutation.isPending) return;
    createMutation.mutate(value);
  };

  const openEdit = (o: Opt) => {
    setEditing(o);
    setEditName(o.name);
    setEditActive(o.isActive);
    setEditInvalid(false);
  };

  const activeCount = options.filter((o) => o.isActive).length;

  return (
    <>
      <SectionCard
        title={`${cap(noun)}s`}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              {activeCount} active
            </Badge>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Quick Add Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitDraft();
            }}
            className="flex flex-wrap items-center gap-2 max-w-md"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={addPlaceholder}
              aria-label={`Add a ${noun}`}
              className="grow"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || createMutation.isPending}
              className="gap-1.5 shrink-0"
            >
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              Add {noun}
            </Button>
          </form>

          {isLoading ? (
            <div className="chip-grid" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} variant="row" width={`${70 + (i % 3) * 30}px`} />
              ))}
            </div>
          ) : (
            <>
              <div className="chip-grid">
                {options.map((o) => (
                  <span
                    key={o.id}
                    className={`option-chip ${skillColorModifier(o.name)}${o.isActive ? '' : ' option-chip--inactive'}`}
                    title={o.isActive ? undefined : 'Hidden from candidate forms'}
                  >
                    <button
                      type="button"
                      className="option-chip__name"
                      onClick={() => openEdit(o)}
                      aria-label={`Edit ${o.name}`}
                    >
                      {o.name}
                    </button>
                    <button
                      type="button"
                      className="option-chip__remove"
                      onClick={() => setToDelete(o)}
                      disabled={removeMutation.isPending}
                      aria-label={`Delete ${o.name}`}
                      title={`Delete ${o.name}`}
                    >
                      <X size={13} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>

              {options.length === 0 && (
                <EmptyState
                  icon={<Tags size={20} strokeWidth={1.75} aria-hidden="true" />}
                  title={`No ${noun} values yet`}
                  description={`Add your first ${noun} using the input field above.`}
                />
              )}
            </>
          )}
        </div>
      </SectionCard>

      <ConfirmModal
        show={toDelete !== null}
        title={`Delete ${noun}`}
        pending={removeMutation.isPending}
        error={removeMutation.isError ? `Could not delete that ${noun}.` : undefined}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
      >
        Delete <strong>{toDelete?.name}</strong>? If any candidate is tagged with it, it is
        deactivated instead — hidden from new forms but kept on existing records.
      </ConfirmModal>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!editName.trim()) {
                setEditInvalid(true);
                return;
              }
              updateMutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit {noun}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-option-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-option-name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editInvalid && e.target.value.trim()) setEditInvalid(false);
                  }}
                  autoFocus
                  aria-invalid={editInvalid}
                />
                {editInvalid && (
                  <p className="text-[length:var(--text-sm)] text-destructive">
                    Name is required.
                  </p>
                )}
              </div>

              <CheckboxField
                id="edit-option-active"
                label="Active"
                description="When unchecked, hidden from candidate forms but preserved on existing records."
                checked={editActive}
                onCheckedChange={(checked) => setEditActive(checked)}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
