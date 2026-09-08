import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  FileCheck2,
  GripVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  cloneEvaluationRubric,
  createEvaluationRubric,
  deleteEvaluationRubric,
  getEvaluationRubrics,
  setDefaultEvaluationRubric,
  updateEvaluationRubric,
} from '../../services/api';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonRows } from '../../components/common/Loading';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { CheckboxField } from '@/components/ui/field';
import { SearchInput } from '@/components/ui/search-input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  EvaluationRubric,
  UpsertEvaluationRubricPayload,
  UpsertRubricCriterionPayload,
} from '../../types';

interface SectionDraft {
  id: string;
  name: string;
  criteria: UpsertRubricCriterionPayload[];
}

const STATUS_FILTERS: { id: 'all' | 'active' | 'inactive' | 'default'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'default', label: 'Default' },
];

export default function EvaluationRubricsTab() {
  const queryClient = useQueryClient();

  const { data: rubrics = [], isLoading, isError } = useQuery({
    queryKey: ['evaluation-rubrics'],
    queryFn: getEvaluationRubrics,
  });

  // Filter & Search states
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'default'>('all');

  const filteredRubrics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rubrics.filter((r) => {
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      if (statusFilter === 'default' && !r.isDefault) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    });
  }, [rubrics, query, statusFilter]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState<EvaluationRubric | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<EvaluationRubric | null>(null);

  const openCreateModal = () => {
    setEditingRubric(null);
    setName('');
    setDescription('');
    setIsDefault(rubrics.length === 0);
    setIsActive(true);
    setErrorMsg(null);
    setSections([
      {
        id: 'sec-1',
        name: 'Technical Competency',
        criteria: [
          {
            sectionName: 'Technical Competency',
            key: 'CoreTechnicalKnowledge',
            label: 'Core Technical Knowledge',
            hint: 'Depth of domain knowledge and practical experience',
            weight: 1,
            sortOrder: 1,
          },
          {
            sectionName: 'Technical Competency',
            key: 'ProblemSolving',
            label: 'Problem Solving & Architecture',
            hint: 'Ability to dissect complexity and design robust solutions',
            weight: 1,
            sortOrder: 2,
          },
        ],
      },
      {
        id: 'sec-2',
        name: 'Soft Skills & Communication',
        criteria: [
          {
            sectionName: 'Soft Skills & Communication',
            key: 'CommunicationClarity',
            label: 'Communication Clarity',
            hint: 'Ability to articulate ideas effectively and listen attentively',
            weight: 1,
            sortOrder: 3,
          },
        ],
      },
    ]);
    setShowModal(true);
  };

  const openEditModal = (rubric: EvaluationRubric) => {
    setEditingRubric(rubric);
    setName(rubric.name);
    setDescription(rubric.description || '');
    setIsDefault(rubric.isDefault);
    setIsActive(rubric.isActive);
    setErrorMsg(null);

    // Group criteria by sectionName
    const sectionMap = new Map<string, UpsertRubricCriterionPayload[]>();
    for (const c of rubric.criteria) {
      const sec = c.sectionName || 'General';
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push({
        id: c.id,
        sectionName: sec,
        key: c.key,
        label: c.label,
        hint: c.hint || '',
        weight: c.weight,
        sortOrder: c.sortOrder,
      });
    }

    const loadedSections: SectionDraft[] = Array.from(sectionMap.entries()).map(([secName, critList], idx) => ({
      id: `sec-${idx}-${Date.now()}`,
      name: secName,
      criteria: critList,
    }));

    setSections(loadedSections.length > 0 ? loadedSections : [
      {
        id: 'sec-1',
        name: 'General',
        criteria: [
          { sectionName: 'General', key: 'Performance', label: 'Overall Performance', hint: '', weight: 1, sortOrder: 1 },
        ],
      },
    ]);
    setShowModal(true);
  };

  // Section manipulation
  const addSection = () => {
    const defaultSecName = 'New Section';
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        name: defaultSecName,
        criteria: [
          {
            sectionName: defaultSecName,
            key: `Criterion_${Date.now()}`,
            label: 'New Criterion',
            hint: '',
            weight: 1,
            sortOrder: 1,
          },
        ],
      },
    ]);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      setErrorMsg('A rubric scorecard must have at least one section.');
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const updateSectionName = (sectionId: string, newName: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              name: newName,
              criteria: s.criteria.map((c) => ({ ...c, sectionName: newName })),
            }
          : s
      )
    );
  };

  // Criterion manipulation
  const addCriterion = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const nextSort = s.criteria.length + 1;
        return {
          ...s,
          criteria: [
            ...s.criteria,
            {
              sectionName: s.name,
              key: `Criterion_${Date.now()}`,
              label: '',
              hint: '',
              weight: 1,
              sortOrder: nextSort,
            },
          ],
        };
      })
    );
  };

  const removeCriterion = (sectionId: string, index: number) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          criteria: s.criteria.filter((_, i) => i !== index),
        };
      })
    );
  };

  const updateCriterion = (
    sectionId: string,
    index: number,
    field: keyof UpsertRubricCriterionPayload,
    val: any
  ) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const nextCriteria = [...s.criteria];
        nextCriteria[index] = {
          ...nextCriteria[index],
          [field]: val,
        };
        // Auto generate key slug if user edits label and key is empty or default
        if (field === 'label' && (!nextCriteria[index].key || nextCriteria[index].key.startsWith('Criterion_'))) {
          const slug = String(val)
            .replace(/[^a-zA-Z0-9]/g, '')
            .trim();
          if (slug) nextCriteria[index].key = slug;
        }
        return { ...s, criteria: nextCriteria };
      })
    );
  };

  // Flatten criteria for payload
  const buildPayload = (): UpsertEvaluationRubricPayload | null => {
    if (!name.trim()) {
      setErrorMsg('Rubric scorecard name is required.');
      return null;
    }

    const flatCriteria: UpsertRubricCriterionPayload[] = [];
    const usedKeys = new Set<string>();
    let sort = 1;

    for (const sec of sections) {
      if (!sec.name.trim()) {
        setErrorMsg('All sections must have a title.');
        return null;
      }
      if (sec.criteria.length === 0) {
        setErrorMsg(`Section "${sec.name}" must contain at least one criterion.`);
        return null;
      }
      for (const crit of sec.criteria) {
        if (!crit.label?.trim()) {
          setErrorMsg('All evaluation criteria must have a label.');
          return null;
        }
        let k = crit.key?.trim();
        if (!k) {
          k = crit.label.replace(/[^a-zA-Z0-9]/g, '').trim() || `Crit${sort}`;
        }
        if (usedKeys.has(k.toLowerCase())) {
          setErrorMsg(`Duplicate criterion key "${k}". Each criterion must have a unique identifier.`);
          return null;
        }
        usedKeys.add(k.toLowerCase());

        flatCriteria.push({
          id: crit.id,
          sectionName: sec.name.trim(),
          key: k,
          label: crit.label.trim(),
          hint: crit.hint?.trim() || null,
          weight: crit.weight && crit.weight > 0 ? Number(crit.weight) : 1,
          sortOrder: sort++,
        });
      }
    }

    if (flatCriteria.length === 0) {
      setErrorMsg('At least one criterion is required.');
      return null;
    }

    return {
      name: name.trim(),
      description: description.trim() || null,
      isDefault,
      isActive,
      criteria: flatCriteria,
    };
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload: UpsertEvaluationRubricPayload) => {
      if (editingRubric) {
        return updateEvaluationRubric(editingRubric.id, payload);
      }
      return createEvaluationRubric(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-rubrics'] });
      void queryClient.invalidateQueries({ queryKey: ['job-openings'] });
      setShowModal(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save rubric scorecard.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvaluationRubric(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-rubrics'] });
      setDeleteTarget(null);
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: number) => cloneEvaluationRubric(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-rubrics'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => setDefaultEvaluationRubric(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation-rubrics'] });
    },
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const payload = buildPayload();
    if (payload) saveMutation.mutate(payload);
  };

  return (
    <div className="evaluation-rubrics-tab page-stack">
      {/* Search and Action Toolbar */}
      <div className="data-toolbar">
        <SearchInput
          wrapperClassName="data-toolbar__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rubric name or description…"
          aria-label="Search evaluation rubrics"
        />
        <div className="data-toolbar__end">
          <div className="segmented" role="group" aria-label="Filter rubrics by status">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={statusFilter === f.id}
                className={statusFilter === f.id ? 'active' : ''}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="toolbar-divider hidden sm:block" />
          <Button size="sm" onClick={openCreateModal} className="shrink-0 gap-1.5">
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            <span>Add rubric scorecard</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} label="Loading evaluation rubrics" />
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Could not load evaluation rubrics"
          description="The request failed. Please refresh the page to try again."
        />
      ) : rubrics.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 size={24} strokeWidth={1.5} />}
          title="No evaluation rubrics yet"
          description="Create custom rubric scorecards to evaluate candidates with role-specific criteria."
          action={
            <Button onClick={openCreateModal}>
              Create your first rubric
            </Button>
          }
        />
      ) : filteredRubrics.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 size={24} strokeWidth={1.5} />}
          title="No rubrics match these filters"
          description="Try a different search query or status filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table table-cards align-middle">
            <thead>
              <tr>
                <th className="w-[360px] lg:w-[420px]">Rubric Name</th>
                <th>Description</th>
                <th className="w-28 text-center">Criteria</th>
                <th className="w-36 text-center">Assigned Openings</th>
                <th className="w-24 text-center">Status</th>
                <th className="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRubrics.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      {r.isDefault && (
                        <Badge variant="brand">
                          <Star fill="currentColor" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="text-muted-foreground text-[length:var(--text-sm)] line-clamp-2">
                      {r.description || '—'}
                    </span>
                  </td>
                  <td className="text-center">
                    <Badge variant="neutral">{r.criteriaCount} criteria</Badge>
                  </td>
                  <td className="text-center">
                    <Badge variant="info">
                      {r.assignedRolesCount} {r.assignedRolesCount === 1 ? 'opening' : 'openings'}
                    </Badge>
                  </td>
                  <td className="text-center">
                    {r.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="btn-icon"
                        title="Edit rubric"
                        aria-label={`Edit ${r.name}`}
                        onClick={() => openEditModal(r)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="btn-icon"
                        title="Duplicate rubric"
                        aria-label={`Duplicate ${r.name}`}
                        onClick={() => cloneMutation.mutate(r.id)}
                        disabled={cloneMutation.isPending}
                      >
                        <Copy size={14} />
                      </Button>
                      {!r.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon text-warning-foreground"
                          title="Set as system default"
                          aria-label={`Set ${r.name} as default`}
                          onClick={() => setDefaultMutation.mutate(r.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          <Star size={14} />
                        </Button>
                      )}
                      {!r.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon text-[var(--danger-text)]"
                          title="Delete rubric"
                          aria-label={`Delete ${r.name}`}
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Rubric Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { (() => setShowModal(false))(); } }}>
<DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleFormSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editingRubric ? `Edit Rubric: ${editingRubric.name}` : 'New Evaluation Scorecard Rubric'}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            {errorMsg && <Alert variant="danger" className="py-2 text-[length:var(--text-sm)]">{errorMsg}</Alert>}

            {/* Rubric Top Metadata */}
            <div className="grid grid-cols-12 gap-4 mb-6">
              <div className="col-span-12 md:col-span-8">
                <Label htmlFor="rubric-name">
                  Rubric Name <span className="text-[var(--danger-text)]">*</span>
                </Label>
                <Input
                  id="rubric-name"
                  placeholder="e.g. Senior Backend Engineer Scorecard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="col-span-12 md:col-span-4 flex flex-col justify-end gap-2">
                <CheckboxField id="rubric-is-default" label="System Default Rubric" checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked)} />
                <CheckboxField id="rubric-is-active" label="Active" checked={isActive} onCheckedChange={(checked) => setIsActive(checked)} />
              </div>

              <div className="col-span-12">
                <Label htmlFor="rubric-desc">Description (Optional)</Label>
                <Textarea
                  id="rubric-desc"
                  rows={2}
                  placeholder="Briefly describe the candidate level, department, or scope this rubric targets..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Dynamic Criteria Builder Header */}
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-border">
              <div>
                <h6 className="mb-0 font-semibold">Scorecard Sections & Criteria</h6>
                <small className="text-muted-foreground">
                  Organize criteria into sections. Weights adjust the overall score contribution.
                </small>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addSection}
                className="flex items-center gap-1"
                >
                <Plus size={13} strokeWidth={2.5} /> Add Section
              </Button>
            </div>

            {/* Section List */}
            <div className="flex flex-col gap-4">
              {sections.map((sec, secIdx) => (
                <div key={sec.id} className="card p-4 border border-border rounded-[var(--radius-lg)] bg-light-subtle">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 grow">
                      <span className="badge bg-secondary-subtle text-text-soft font-monospace">
                        Section {secIdx + 1}
                      </span>
                      <Input
                        className="h-[var(--control-h-sm)] text-[length:var(--text-sm)] font-semibold"
                        placeholder="Section Name (e.g. Technical Knowledge)"
                        value={sec.name}
                        onChange={(e) => updateSectionName(sec.id, e.target.value)}
                        style={{ maxWidth: 300 }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="py-0.5 px-2 text-xs"
                        onClick={() => addCriterion(sec.id)}
                      >
                        <Plus size={12} /> Add Criterion
                      </Button>
                      {sections.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-icon text-[var(--danger-text)] py-0.5"
                          title="Remove section"
                          onClick={() => removeSection(sec.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Criteria in Section */}
                  <div className="flex flex-col gap-2 mt-1">
                    {sec.criteria.map((crit, cIdx) => (
                      <div
                        key={`${sec.id}-crit-${cIdx}`}
                        className="flex items-center gap-2 p-2 bg-background rounded-[var(--radius-md)] border border-border"
                      >
                        <GripVertical size={14} className="text-muted-foreground shrink-0" />
                        <div className="grow grid grid-cols-12 gap-4 gap-2">
                          <div className="col-span-12 md:col-span-5">
                            <Input className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
                              placeholder="Criterion Label (e.g. System Design)"
                              value={crit.label}
                              onChange={(e) => updateCriterion(sec.id, cIdx, 'label', e.target.value)}
                              required
                            />
                          </div>
                          <div className="col-span-12 md:col-span-5">
                            <Input className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
                              placeholder="Evaluation guide hint / rubric standard..."
                              value={crit.hint || ''}
                              onChange={(e) => updateCriterion(sec.id, cIdx, 'hint', e.target.value)}
                            />
                          </div>
                          <div className="col-span-6 md:col-span-2 flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Weight:</span>
                            <Input className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="10"
                              value={crit.weight ?? 1}
                              onChange={(e) => updateCriterion(sec.id, cIdx, 'weight', parseFloat(e.target.value) || 1)}
                              style={{ width: 64 }}
                            />
                          </div>
                        </div>
                        {sec.criteria.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="btn-icon text-muted-foreground hover-danger shrink-0"
                            onClick={() => removeCriterion(sec.id, cIdx)}
                          >
                            <X size={13} strokeWidth={2.5} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Rubric Scorecard'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
</Dialog>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          show={!!deleteTarget}
          title={`Delete Rubric: ${deleteTarget.name}?`}
          confirmLabel="Delete Rubric"
          confirmVariant="destructive"
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          pending={deleteMutation.isPending}
        >
          Are you sure you want to delete &ldquo;{deleteTarget.name}&rdquo;? Job openings linked to this rubric will automatically revert to the system default.
        </ConfirmModal>
      )}
    </div>
  );
}
