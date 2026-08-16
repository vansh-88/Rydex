import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback } from 'react';

import {
  listDriverApplications,
  rejectDriverApplication,
  verifyDriverApplication,
} from '@/api/endpoints/admin';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { PendingDriverApplication } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDeparture } from '@/lib/kolkataDate';

import { ReviewDecision } from './ReviewDecision';

export function DriverApplications() {
  const { data, error, isLoading, refetch } = useApiQuery(
    'admin:driver-applications',
    useCallback((signal: AbortSignal) => listDriverApplications(signal), []),
    // A review queue is worth re-reading on every visit — a stale one wastes
    // the reviewer's time on an application a colleague already handled.
    { staleTime: 0 },
  );

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined) return <ErrorState error={error} onRetry={refetch} />;

  const applications = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Driver applications</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          {applications.length} awaiting review. Approving also grants the driver role.
        </p>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="New driver applications will appear here."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((application) => (
            <ApplicationCard
              key={application.userId}
              application={application}
              onDecided={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  application,
  onDecided,
}: {
  application: PendingDriverApplication;
  onDecided: () => void;
}) {
  const { toast } = useToast();

  const verify = useApiMutation(() => verifyDriverApplication(application.userId), {
    invalidates: ['admin:driver-applications'],
    onSuccess: () => {
      toast(`${application.name} is now a verified driver.`, 'success');
      onDecided();
    },
  });

  const reject = useApiMutation(
    (reason: string) => rejectDriverApplication(application.userId, reason),
    {
      invalidates: ['admin:driver-applications'],
      onSuccess: () => {
        toast(`${application.name}'s application was rejected.`, 'info');
        onDecided();
      },
    },
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="font-medium text-ink">{application.name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {application.email}
            <span className="text-ink-faint"> · {application.phone}</span>
          </p>
        </div>
        <p className="shrink-0 text-xs text-ink-faint">
          {formatDeparture(application.submittedAt)}
        </p>
      </CardHeader>

      <CardBody className="space-y-4">
        {application.licenseDocumentUrl !== null ? (
          <a
            href={application.licenseDocumentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:text-accent-800"
          >
            Open driving licence
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          // Cloudinary URLs are signed and time-limited; a missing one means
          // the document could not be resolved, which is itself a reason not
          // to approve.
          <p className="text-sm text-red-700">
            The licence document could not be loaded. Do not approve without seeing it.
          </p>
        )}

        <ReviewDecision
          subject={`${application.name}'s application`}
          isPending={verify.isPending || reject.isPending}
          error={verify.error ?? reject.error}
          onVerify={() => {
            verify.mutate(undefined);
          }}
          onReject={(reason) => {
            reject.mutate(reason);
          }}
        />
      </CardBody>
    </Card>
  );
}
