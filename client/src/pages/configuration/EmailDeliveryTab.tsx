import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { getEmailOutbox, resendEmail } from '../../services/api';
import { useToast } from '../../components/ToastStack';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import RowActions, { RowAction } from '../../components/common/RowActions';
import { SkeletonRows } from '../../components/common/Loading';
import type { OutboundEmail, OutboundEmailStatus } from '../../types';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';

const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: OutboundEmailStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Sending', label: 'Sending' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Unknown', label: 'Unknown' },
];

const STATUS_TONE: Record<OutboundEmailStatus, BadgeVariant> = {
  Pending: 'info',
  Sending: 'warning',
  Sent: 'success',
  Failed: 'danger',
  Unknown: 'neutral',
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const canResend = (status: OutboundEmailStatus) => status === 'Failed' || status === 'Unknown';

/**
 * Every outbound transactional email (interview invites, account/password notices, admin test
 * sends), durably queued and retried by the server-side outbox worker (see ai-docs/backend.md).
 * Read-only plus a Resend action; the body is never shown here (it can contain account details, and
 * the API never returns it, see OutboundEmailDto).
 */
export default function EmailDeliveryTab() {
  const [status, setStatus] = useState<OutboundEmailStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [toResend, setToResend] = useState<OutboundEmail | null>(null);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['config', 'email-outbox', status, page],
    queryFn: () => getEmailOutbox({ status: status === 'all' ? undefined : status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) => resendEmail(id),
    onSuccess: (res) => {
      if (res.ok) {
        addToast('Email queued for resend.');
        queryClient.invalidateQueries({ queryKey: ['config', 'email-outbox'] });
        setToResend(null);
      } else {
        addToast(res.error ?? 'Could not resend that email.', 'danger');
      }
    },
    onError: () => addToast('Could not resend that email.', 'danger'),
  });

  const total = data?.totalCount ?? 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <Segmented
          type="single"
          value={status}
          onValueChange={(v) => {
            if (!v) return; // Radix single mode allows deselecting; ignore it, "all" stays the floor.
            setStatus(v as OutboundEmailStatus | 'all');
            setPage(1);
          }}
        >
          {STATUS_FILTERS.map((f) => (
            <SegmentedItem key={f.value} value={f.value}>
              {f.label}
            </SegmentedItem>
          ))}
        </Segmented>

        {isLoading ? (
          <SkeletonRows rows={10} label="Loading email delivery log" />
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Couldn't load the email delivery log"
            description="The request failed. Refresh the page to try again."
          />
        ) : data!.items.length === 0 ? (
          <EmptyState
            icon={<Mail size={20} strokeWidth={1.75} aria-hidden="true" />}
            title="No emails match"
            description={
              status === 'all'
                ? 'Transactional email sent by the app (interview invites, account notices, admin tests) will show up here.'
                : `No emails are currently ${status.toLowerCase()}.`
            }
          />
        ) : (
          <>
            {isFetching && (
              <span className="result-count" aria-live="polite">
                Updating…
              </span>
            )}

            <div className="table-wrap">
              <table className="table table-cards align-middle">
                <thead>
                  <tr>
                    <th>Queued</th>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Last error</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Queued" className="whitespace-nowrap table-muted">{fmt(e.createdAt)}</td>
                      <td data-label="To" className="whitespace-nowrap">{e.toEmail}</td>
                      <td data-label="Subject">{e.subject}</td>
                      <td data-label="Status">
                        <Badge variant={STATUS_TONE[e.status]}>{e.status}</Badge>
                      </td>
                      <td data-label="Attempts" className="col-mono">{e.attempts}</td>
                      <td data-label="Last error" className="text-muted-foreground">{e.lastError ?? '—'}</td>
                      <td data-label="" className="text-right">
                        {canResend(e.status) && (
                          <RowActions label={`Actions for email to ${e.toEmail}`}>
                            <RowAction onClick={() => setToResend(e)}>Resend</RowAction>
                          </RowActions>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} noun="email" />
          </>
        )}
      </div>

      <ConfirmModal
        show={toResend !== null}
        title="Resend email"
        confirmLabel="Resend"
        confirmVariant="default"
        pending={resendMutation.isPending}
        error={resendMutation.isError ? 'Could not resend that email.' : undefined}
        onCancel={() => setToResend(null)}
        onConfirm={() => toResend && resendMutation.mutate(toResend.id)}
      >
        Resend to <strong>{toResend?.toEmail}</strong>?
        {toResend?.status === 'Unknown' && (
          <>
            {' '}
            Its last attempt's outcome is unknown, it may already have been delivered, so this could
            send a duplicate.
          </>
        )}
      </ConfirmModal>
    </>
  );
}
