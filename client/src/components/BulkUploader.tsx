import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, UploadCloud, XCircle } from 'lucide-react';
import { getActiveRoleOptions, uploadCV } from '../services/api';
import { getCVUploadHubConnection, startCVUploadHub, type CVUploadProgressEvent } from '../services/signalr';
import type { CVDraft } from '../types';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

interface Props {
  onDraftsParsed: (drafts: CVDraft[], batchId?: string) => void;
}

interface FileProgressState {
  fileName: string;
  status: 'queued' | 'parsing' | 'completed' | 'error';
  error?: string | null;
}

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export default function BulkUploader({ onDraftsParsed }: Props) {
  const [batchName, setBatchName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileProgresses, setFileProgresses] = useState<FileProgressState[]>([]);
  const currentBatchId = useRef<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['active-role-options'],
    queryFn: getActiveRoleOptions,
  });

  useEffect(() => {
    let active = true;

    startCVUploadHub().then((hub) => {
      if (!active || !hub) return;

      const handleProgress = (event: CVUploadProgressEvent) => {
        if (event.batchId === currentBatchId.current) {
          setFileProgresses((prev) => {
            const next = [...prev];
            if (next[event.fileIndex]) {
              next[event.fileIndex] = {
                fileName: event.fileName,
                status: event.status,
                error: event.error,
              };
            }
            return next;
          });
        }
      };

      hub.on('OnUploadProgress', handleProgress);

      return () => {
        hub.off('OnUploadProgress', handleProgress);
      };
    });

    return () => {
      active = false;
    };
  }, []);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      currentBatchId.current = batchId;

      const hub = getCVUploadHubConnection();
      if (hub.state === 'Connected') {
        try {
          await hub.invoke('JoinBatchGroup', batchId);
        } catch {
          // best-effort join
        }
      }

      setBusy(true);
      setErrors([]);
      setDone(0);
      setTotal(files.length);
      setFileProgresses(
        files.map((f) => ({
          fileName: f.name,
          status: 'queued',
        }))
      );

      const drafts: CVDraft[] = [];
      const failures: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setFileProgresses((prev) => {
          const next = [...prev];
          if (next[i]) next[i] = { fileName: file.name, status: 'parsing' };
          return next;
        });

        try {
          const draft = await uploadCV(
            file,
            batchId,
            i,
            files.length,
            batchName.trim() || undefined,
            selectedRoleId ?? undefined
          );
          drafts.push(draft);
          setFileProgresses((prev) => {
            const next = [...prev];
            if (next[i]) next[i] = { fileName: file.name, status: 'completed' };
            return next;
          });
        } catch (err: any) {
          failures.push(file.name);
          setFileProgresses((prev) => {
            const next = [...prev];
            if (next[i])
              next[i] = {
                fileName: file.name,
                status: 'error',
                error: err?.response?.data || 'Failed to extract file',
              };
            return next;
          });
        } finally {
          setDone((d) => d + 1);
        }
      }

      setErrors(failures);
      setBusy(false);
      if (drafts.length > 0) onDraftsParsed(drafts, batchId);
    },
    [batchName, selectedRoleId, onDraftsParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    disabled: busy,
  });

  const className = [
    'empty-state',
    'dropzone',
    isDragActive && 'dropzone--active',
    busy && 'dropzone--busy',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="page-stack page-stack--tight">
      <div className="flex flex-wrap items-center gap-4 mb-1">
        <div className="flex items-center gap-2" style={{ maxWidth: 360, width: '100%' }}>
          <label htmlFor="batch-name-input" className="text-[length:var(--text-sm)] font-semibold text-muted-foreground whitespace-nowrap">
            Batch Label:
          </label>
          <Input
            id="batch-name-input"
            className="h-[var(--control-h-sm)] text-[length:var(--text-sm)]"
            placeholder="e.g. Q3 Senior Engineering Intake"
            value={batchName}
            disabled={busy}
            onChange={(e) => setBatchName(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2" style={{ maxWidth: 360, width: '100%' }}>
          <label htmlFor="job-role-select" className="text-[length:var(--text-sm)] font-semibold text-muted-foreground whitespace-nowrap">
            Job Opening:
          </label>
          <NativeSelect
            id="job-role-select"
            size="sm"
            value={selectedRoleId ?? ''}
            disabled={busy}
            onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Target Job Opening"
          >
            <option value="">Select Job Opening (Optional)…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div {...getRootProps()} className={className}>
        <input {...getInputProps()} />
        {busy ? (
          <div className="dropzone__progress" role="status" aria-live="polite">
            <Spinner aria-hidden="true" />
            <div className="empty-state-title">Parsing CVs in background…</div>
            <div className="empty-state-description">
              {done} of {total} read
            </div>
            <Progress
              className="dropzone__bar"
              value={total ? (done / total) * 100 : 0}
              aria-label={`Parsed ${done} of ${total} files`}
            />
          </div>
        ) : (
          <>
            <span className="empty-state__icon">
              <UploadCloud size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="empty-state-title">Drag &amp; drop CVs here, or click to browse</div>
            <div className="empty-state-description">
              PDF or Word (.docx), up to 10&nbsp;MB each. Several at once is fine — real-time
              processing will parse them in the background.
            </div>
          </>
        )}
      </div>

      {busy && fileProgresses.length > 0 && (
        <div className="card p-4 shadow-xs border border-border">
          <div className="text-[length:var(--text-sm)] font-bold text-muted-foreground uppercase mb-2">Live Parsing Queue</div>
          <div className="flex flex-col gap-2">
            {fileProgresses.map((fp, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-[var(--radius-md)] bg-muted border border-border text-[length:var(--text-sm)]"
              >
                <div className="flex items-center gap-2 truncate mr-2">
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{fp.fileName}</span>
                </div>
                <div className="shrink-0">
                  {fp.status === 'queued' && (
                    <Badge variant="neutral">Queued</Badge>
                  )}
                  {fp.status === 'parsing' && (
                    <Badge variant="brand">
                      <Spinner className="size-3" />
                      Parsing
                    </Badge>
                  )}
                  {fp.status === 'completed' && (
                    <Badge variant="success">
                      <CheckCircle2 />
                      Extracted
                    </Badge>
                  )}
                  {fp.status === 'error' && (
                    <Badge variant="danger">
                      <XCircle />
                      Failed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <Alert variant="warning" className="mb-0">
          Could not parse {errors.length} file{errors.length === 1 ? '' : 's'}: {errors.join(', ')}
        </Alert>
      )}
    </div>
  );
}
