import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Copy, Download, FileJson, UploadCloud, XCircle } from 'lucide-react';
import { downloadImportTemplate, getActiveRoleOptions, importJsonCandidate } from '../services/api';
import type { CVDraft } from '../types';
import { parseImportManifest, type ImportManifest } from '../utils/importManifest';
import { jobStatus } from '../utils/jobStatus';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  onDraftsParsed: (drafts: CVDraft[], batchId?: string) => void;
}

interface RowProgress {
  status: 'queued' | 'importing' | 'completed' | 'error' | 'duplicate';
  message?: string | null;
  warnings?: string[];
}

const ACCEPTED = {
  'application/json': ['.json'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const isJson = (f: File) => f.name.toLowerCase().endsWith('.json');

/**
 * Admin and Super Admin only. Imports candidates from a JSON file (made from the downloadable template)
 * together with the CVs it names. Each valid entry is sent with its CV, one at a time, and becomes a
 * Pending draft in the Review Workspace, just like a parsed CV.
 */
export default function JsonImporter({ onDraftsParsed }: Props) {
  const [batchName, setBatchName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [dropError, setDropError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<number, RowProgress>>({});
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);

  const { data: allRoles = [] } = useQuery({
    queryKey: ['active-role-options'],
    queryFn: getActiveRoleOptions,
  });
  // A job opening must be selected to import; only ones still open are offerable.
  const roles = allRoles.filter((r) => jobStatus(r) === 'open' || jobStatus(r) === 'closing-soon');

  useEffect(() => {
    let current = true;
    if (!jsonFile) {
      setJsonText(null);
      return;
    }
    jsonFile.text().then((t) => {
      if (current) setJsonText(t);
    });
    return () => {
      current = false;
    };
  }, [jsonFile]);

  const manifest: ImportManifest | null = useMemo(
    () => (jsonText === null ? null : parseImportManifest(jsonText, cvFiles)),
    [jsonText, cvFiles]
  );
  const validRows = manifest?.rows.filter((r) => r.errors.length === 0) ?? [];

  const onDrop = useCallback((files: File[]) => {
    setDropError(null);
    const jsons = files.filter(isJson);
    const cvs = files.filter((f) => !isJson(f));
    if (jsons.length > 1) {
      setDropError('Add one JSON file at a time.');
      return;
    }
    if (jsons.length === 1) setJsonFile(jsons[0]);
    if (cvs.length > 0) {
      // A CV dropped again under the same name replaces the earlier one.
      setCvFiles((prev) => {
        const byName = new Map(prev.map((f) => [f.name.toLowerCase(), f]));
        cvs.forEach((f) => byName.set(f.name.toLowerCase(), f));
        return [...byName.values()];
      });
    }
    setProgress({});
    setFinished(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    disabled: busy,
  });

  const reset = () => {
    setJsonFile(null);
    setCvFiles([]);
    setProgress({});
    setDropError(null);
    setFinished(false);
  };

  const handleDownloadTemplate = async () => {
    setTemplateError(null);
    try {
      await downloadImportTemplate();
    } catch {
      setTemplateError('Could not download the template. Please try again.');
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0 || selectedRoleId == null) return;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setBusy(true);
    setFinished(false);
    setProgress(Object.fromEntries(validRows.map((r) => [r.index, { status: 'queued' } as RowProgress])));

    const drafts: CVDraft[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress((prev) => ({ ...prev, [row.index]: { status: 'importing' } }));
      try {
        const result = await importJsonCandidate(
          row.entry,
          row.file!,
          batchId,
          i,
          validRows.length,
          batchName.trim() || undefined,
          selectedRoleId ?? undefined
        );
        drafts.push(result.draft);
        setProgress((prev) => ({ ...prev, [row.index]: { status: 'completed', warnings: result.warnings } }));
      } catch (err: any) {
        // 409 = the server already holds a CV with identical content.
        const isDuplicate = err?.response?.status === 409;
        const message = typeof err?.response?.data === 'string' ? err.response.data : 'Import failed.';
        setProgress((prev) => ({ ...prev, [row.index]: { status: isDuplicate ? 'duplicate' : 'error', message } }));
      }
    }

    setBusy(false);
    setFinished(true);
    if (drafts.length > 0) onDraftsParsed(drafts, batchId);
  };

  const completed = Object.values(progress).filter((p) => p.status !== 'queued' && p.status !== 'importing').length;
  const failed = Object.values(progress).filter((p) => p.status === 'error' || p.status === 'duplicate').length;

  const dropzoneClass = ['empty-state', 'dropzone', isDragActive && 'dropzone--active', busy && 'dropzone--busy']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="page-stack page-stack--tight">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-muted p-3">
        <div className="text-[length:var(--text-sm)] text-muted-foreground">
          Start from the template. The instructions for filling it in, by hand or with an AI assistant, are
          written as comments inside the file.
        </div>
        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
          <Download />
          Download JSON template
        </Button>
      </div>
      {templateError && (
        <Alert variant="danger" className="mb-0">
          {templateError}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-1">
        <div className="flex items-center gap-2" style={{ maxWidth: 360, width: '100%' }}>
          <label htmlFor="json-batch-name-input" className="text-[length:var(--text-sm)] font-semibold text-muted-foreground whitespace-nowrap">
            Batch Label:
          </label>
          <Input
            id="json-batch-name-input"
            className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
            placeholder="e.g. Q3 Senior Engineering Intake"
            value={batchName}
            disabled={busy}
            onChange={(e) => setBatchName(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2" style={{ maxWidth: 360, width: '100%' }}>
          <label htmlFor="json-job-role-select" className="text-[length:var(--text-sm)] font-semibold text-muted-foreground whitespace-nowrap">
            Job Opening:
          </label>
          <NativeSelect
            id="json-job-role-select"
            size="sm"
            required
            value={selectedRoleId ?? ''}
            disabled={busy}
            onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Default Job Opening"
          >
            <option value="">Default Job Opening…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div {...getRootProps()} className={dropzoneClass}>
        <input {...getInputProps()} />
        {busy ? (
          <div className="dropzone__progress" role="status" aria-live="polite">
            <Spinner aria-hidden="true" />
            <div className="empty-state-title">Importing candidates…</div>
            <div className="empty-state-description">
              {completed} of {validRows.length} done
            </div>
            <Progress
              className="dropzone__bar"
              value={validRows.length ? (completed / validRows.length) * 100 : 0}
              aria-label={`Imported ${completed} of ${validRows.length} candidates`}
            />
          </div>
        ) : (
          <>
            <span className="empty-state__icon">
              <UploadCloud size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="empty-state-title">Drop the JSON file and its CVs here, or click to browse</div>
            <div className="empty-state-description">
              One .json file plus every CV it names (PDF or Word .docx, up to 10&nbsp;MB each). Entries
              without a matching CV are not imported. The job opening above applies to entries with no role.
            </div>
          </>
        )}
      </div>

      {dropError && (
        <Alert variant="warning" className="mb-0">
          {dropError}
        </Alert>
      )}

      {(jsonFile || cvFiles.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-sm)]">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <FileJson size={14} className="shrink-0" />
            <span className="font-semibold text-foreground">{jsonFile?.name ?? 'No JSON file yet'}</span>
            <span>
              · {cvFiles.length} CV{cvFiles.length === 1 ? '' : 's'} added
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
            Clear
          </Button>
        </div>
      )}

      {manifest?.error && (
        <Alert variant="danger" className="mb-0">
          {manifest.error}
        </Alert>
      )}

      {manifest && manifest.rows.length > 0 && (
        <div className="card p-0 border border-border shadow-xs">
          <Table aria-label="Import pre-check">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CV</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifest.rows.map((row) => {
                const p = progress[row.index];
                const notes = [...row.errors, ...row.warnings, ...(p?.warnings ?? [])];
                return (
                  <TableRow key={row.index}>
                    <TableCell>{row.index}</TableCell>
                    <TableCell className="font-semibold">{row.fullName ?? '-'}</TableCell>
                    <TableCell>{row.email ?? '-'}</TableCell>
                    <TableCell>{row.file ? row.file.name : <span className="text-[var(--danger-text)]">{row.cvFileName ?? 'Missing'}</span>}</TableCell>
                    <TableCell>{row.role ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <RowBadge errors={row.errors.length} warnings={row.warnings.length} progress={p} />
                        {p?.message && <span className="text-[length:var(--text-xs)] text-[var(--danger-text)]">{p.message}</span>}
                        {notes.map((n, i) => (
                          <span key={i} className="text-[length:var(--text-xs)] text-muted-foreground">
                            {n}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {manifest && manifest.unusedFiles.length > 0 && (
        <Alert variant="warning" className="mb-0">
          {manifest.unusedFiles.length} CV{manifest.unusedFiles.length === 1 ? ' is' : 's are'} not named by any
          entry and will not be imported: {manifest.unusedFiles.join(', ')}
        </Alert>
      )}

      {manifest && manifest.rows.length > 0 && !finished && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {selectedRoleId == null && (
            <span className="text-[length:var(--text-sm)] text-muted-foreground">
              Choose a default job opening to import.
            </span>
          )}
          {validRows.length < manifest.rows.length && (
            <span className="text-[length:var(--text-sm)] text-muted-foreground">
              {manifest.rows.length - validRows.length} entr{manifest.rows.length - validRows.length === 1 ? 'y' : 'ies'} with
              errors will be skipped.
            </span>
          )}
          <Button onClick={handleImport} disabled={busy || validRows.length === 0 || selectedRoleId == null}>
            Import {validRows.length} candidate{validRows.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}

      {finished && failed > 0 && (
        <Alert variant="warning" className="mb-0">
          {failed} candidate{failed === 1 ? ' was' : 's were'} not imported. See the Check column for the reason.
        </Alert>
      )}
    </div>
  );
}

function RowBadge({ errors, warnings, progress }: { errors: number; warnings: number; progress?: RowProgress }) {
  if (progress?.status === 'queued') return <Badge variant="neutral">Queued</Badge>;
  if (progress?.status === 'importing')
    return (
      <Badge variant="brand">
        <Spinner className="size-3" />
        Importing
      </Badge>
    );
  if (progress?.status === 'completed')
    return (
      <Badge variant="success">
        <CheckCircle2 />
        Staged
      </Badge>
    );
  if (progress?.status === 'duplicate')
    return (
      <Badge variant="warning">
        <Copy />
        Duplicate
      </Badge>
    );
  if (progress?.status === 'error' || errors > 0)
    return (
      <Badge variant="danger">
        <XCircle />
        {progress ? 'Failed' : 'Will be skipped'}
      </Badge>
    );
  if (warnings > 0)
    return (
      <Badge variant="warning">
        <AlertTriangle />
        Ready, check notes
      </Badge>
    );
  return (
    <Badge variant="success">
      <CheckCircle2 />
      Ready
    </Badge>
  );
}
