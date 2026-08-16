import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getVehicle, uploadVehicleDocument } from '@/api/endpoints/vehicles';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { VehicleDocumentType } from '@/api/types';
import { ErrorState, InlineError } from '@/components/domain/States';
import { StatusPill } from '@/components/domain/StatusPill';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { VERIFICATION_STATUS } from '@/lib/statusMaps';

const DOCUMENT_TYPES: { value: VehicleDocumentType; label: string; hint: string }[] = [
  { value: 'RC', label: 'Registration certificate (RC)', hint: 'Proves the vehicle is yours.' },
  { value: 'INSURANCE', label: 'Insurance', hint: 'Must be currently valid.' },
  { value: 'POLLUTION', label: 'Pollution certificate (PUC)', hint: 'Must be currently valid.' },
];

export function VehicleDetail() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();

  const { data: vehicle, error, isLoading, refetch } = useApiQuery(
    vehicleId !== undefined ? `vehicles:${vehicleId}` : null,
    useCallback((signal: AbortSignal) => getVehicle(vehicleId ?? '', signal), [vehicleId]),
  );

  if (isLoading) return <ListSkeleton rows={3} />;
  if (error !== undefined || vehicle === undefined) {
    return <ErrorState error={error} onRetry={refetch} className="my-12" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => {
          void navigate('/vehicles');
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My vehicles
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="mt-1 text-ink-muted">
            {vehicle.registrationNumber}
            <span className="text-ink-faint">
              {' '}
              · {vehicle.seatCapacity} seats · {vehicle.isAc ? 'AC' : 'Non-AC'}
            </span>
          </p>
        </div>
        <StatusPill status={vehicle.verificationStatus} map={VERIFICATION_STATUS} />
      </div>

      {vehicle.verificationStatus === 'REJECTED' && vehicle.rejectionReason !== null && (
        <Card className="border-red-200 bg-red-50/50">
          <CardBody>
            <p className="font-medium text-ink">This vehicle was rejected</p>
            <p className="mt-1 text-sm text-ink-muted">{vehicle.rejectionReason}</p>
            <p className="mt-2 text-sm text-ink-muted">
              Upload corrected documents below and it will be reviewed again.
            </p>
          </CardBody>
        </Card>
      )}

      {vehicle.verificationStatus === 'PENDING' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardBody>
            <p className="font-medium text-ink">Waiting for review</p>
            <p className="mt-1 text-sm text-ink-muted">
              Once all three documents are uploaded, a Rydex reviewer checks them by hand. You
              can&rsquo;t publish rides with this vehicle until it&rsquo;s verified.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="space-y-3">
        {DOCUMENT_TYPES.map((type) => {
          const existing = vehicle.documents?.find((doc) => doc.documentType === type.value);
          return (
            <DocumentRow
              key={type.value}
              vehicleId={vehicle.id}
              type={type}
              existing={existing}
              onUploaded={refetch}
            />
          );
        })}
      </div>
    </div>
  );
}

function DocumentRow({
  vehicleId,
  type,
  existing,
  onUploaded,
}: {
  vehicleId: string;
  type: { value: VehicleDocumentType; label: string; hint: string };
  existing:
    | { id: string; status: string; documentUrl: string; createdAt: string }
    | undefined;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useApiMutation(
    (upload: File) => uploadVehicleDocument(vehicleId, upload, type.value),
    {
      invalidates: ['vehicles'],
      onSuccess: () => {
        toast(`${type.label} uploaded.`, 'success');
        setFile(null);
        onUploaded();
      },
    },
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="font-medium text-ink">{type.label}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{type.hint}</p>
        </div>
        {existing !== undefined && <StatusPill status={existing.status} map={VERIFICATION_STATUS} />}
      </CardHeader>

      <CardBody className="space-y-3">
        {existing !== undefined && (
          <a
            href={existing.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent-700 hover:text-accent-800"
          >
            View uploaded document
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}

        <FileUpload
          label={existing === undefined ? 'Upload' : 'Replace'}
          value={file}
          onChange={setFile}
          disabled={mutation.isPending}
        />

        {mutation.error !== undefined && <InlineError error={mutation.error} />}

        {file !== null && (
          <Button
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate(file);
            }}
          >
            Upload {type.value === 'RC' ? 'RC' : type.label.toLowerCase()}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
