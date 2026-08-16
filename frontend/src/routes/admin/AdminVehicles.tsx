import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback } from 'react';

import { listPendingVehicles, rejectVehicle, verifyVehicle } from '@/api/endpoints/admin';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { VehicleReview } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { StatusPill } from '@/components/domain/StatusPill';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { VERIFICATION_STATUS } from '@/lib/statusMaps';

import { ReviewDecision } from './ReviewDecision';

const DOCUMENT_LABELS: Record<string, string> = {
  RC: 'Registration certificate',
  INSURANCE: 'Insurance',
  POLLUTION: 'Pollution certificate',
};

const REQUIRED_DOCUMENTS = ['RC', 'INSURANCE', 'POLLUTION'];

export function AdminVehicles() {
  const { data, error, isLoading, refetch } = useApiQuery(
    'admin:vehicles',
    useCallback((signal: AbortSignal) => listPendingVehicles(signal), []),
    { staleTime: 0 },
  );

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined) return <ErrorState error={error} onRetry={refetch} />;

  const reviews = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Vehicles</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          {reviews.length} awaiting review. A vehicle cannot carry passengers until it is verified.
        </p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="Vehicles submitted for verification will appear here."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <VehicleReviewCard key={review.vehicle.id} review={review} onDecided={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleReviewCard({
  review,
  onDecided,
}: {
  review: VehicleReview;
  onDecided: () => void;
}) {
  const { toast } = useToast();
  const { vehicle, owner } = review;

  const verify = useApiMutation(() => verifyVehicle(vehicle.id), {
    invalidates: ['admin:vehicles'],
    onSuccess: () => {
      toast(`${vehicle.registrationNumber} verified.`, 'success');
      onDecided();
    },
  });

  const reject = useApiMutation((reason: string) => rejectVehicle(vehicle.id, reason), {
    invalidates: ['admin:vehicles'],
    onSuccess: () => {
      toast(`${vehicle.registrationNumber} rejected.`, 'info');
      onDecided();
    },
  });

  const documents = vehicle.documents ?? [];
  const missing = REQUIRED_DOCUMENTS.filter(
    (type) => !documents.some((doc) => doc.documentType === type),
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">
              {vehicle.make} {vehicle.model}
            </p>
            <StatusPill status={vehicle.verificationStatus} map={VERIFICATION_STATUS} />
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {vehicle.registrationNumber}
            <span className="text-ink-faint">
              {' '}
              · {vehicle.vehicleType} · {vehicle.seatCapacity} seats ·{' '}
              {vehicle.isAc ? 'AC' : 'Non-AC'}
            </span>
          </p>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <div className="rounded-lg bg-canvas p-3 text-sm">
          <p className="font-medium text-ink">{owner.name}</p>
          <p className="text-ink-muted">
            {owner.email}
            <span className="text-ink-faint"> · {owner.phone}</span>
          </p>
        </div>

        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3">
              <a
                href={doc.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent-700 hover:text-accent-800"
              >
                {DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <StatusPill status={doc.status} map={VERIFICATION_STATUS} />
            </div>
          ))}

          {/* Approving a vehicle whose papers are not all present is the main
              way this queue can go wrong, so the gap is called out rather
              than left for the reviewer to notice. */}
          {missing.length > 0 && (
            <p className="text-sm text-red-700">
              Missing:{' '}
              {missing.map((type) => DOCUMENT_LABELS[type] ?? type).join(', ')}
            </p>
          )}
        </div>

        <ReviewDecision
          subject={vehicle.registrationNumber}
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
