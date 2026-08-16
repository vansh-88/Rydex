import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { submitDriverApplication } from '@/api/endpoints/auth';
import { useApiMutation } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { InlineError } from '@/components/domain/States';
import { StatusPill } from '@/components/domain/StatusPill';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { useToast } from '@/components/ui/Toast';
import { DRIVER_LICENSE_STATUS } from '@/lib/statusMaps';

// Becoming a driver on Rydex is a funnel with two separate human approvals —
// licence first, then a vehicle. This screen owns the first, and hands over to
// the vehicle flow once it is granted.
//
// The waiting states are real screens rather than spinners: a manual review
// can take hours, and a user who is told nothing assumes the app is broken.
export function BecomeDriver() {
  const { user, refreshUser, isDriver } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useApiMutation((licence: File) => submitDriverApplication(licence), {
    onSuccess: () => {
      toast('Licence submitted. We’ll review it shortly.', 'success');
      setFile(null);
      // The profile now carries driverLicenseStatus: PENDING, which is what
      // switches this screen to its waiting state.
      void refreshUser();
    },
  });

  const status = user?.driverLicenseStatus ?? 'NONE';

  // Approval flips the role to DRIVER in the same transaction that verifies
  // the licence, so a verified user's next step is a vehicle.
  if (isDriver || status === 'VERIFIED') {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <Card>
          <CardBody className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-600" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold text-ink">You&rsquo;re a verified driver</h1>
              <p className="mt-1 text-sm text-ink-muted">
                One more step: add a vehicle and upload its documents. A vehicle has to be
                verified before you can publish a ride with it.
              </p>
            </div>
            <Link to="/vehicles" className={buttonStyles()}>
              Add a vehicle
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === 'PENDING') {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <Card>
          <CardBody className="space-y-4 text-center">
            <Clock className="mx-auto size-8 text-amber-600" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold text-ink">Your licence is under review</h1>
              <p className="mt-1 text-sm text-ink-muted">
                A member of the Rydex team checks every licence by hand. We&rsquo;ll email you as
                soon as it&rsquo;s done — there&rsquo;s nothing else you need to do right now.
              </p>
            </div>
            <div className="flex justify-center">
              <StatusPill status={status} map={DRIVER_LICENSE_STATUS} />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Become a driver</h1>
        <p className="mt-1 text-ink-muted">
          Publish trips you&rsquo;re already making and sell the empty seats.
        </p>
      </div>

      {/* A rejection carries a reason written by a human reviewer. Showing it
          verbatim is the only way the user knows what to fix. */}
      {status === 'REJECTED' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardBody className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="font-medium text-ink">Your last submission was rejected</p>
              {user?.driverLicenseRejectionReason !== null &&
                user?.driverLicenseRejectionReason !== undefined && (
                  <p className="mt-1 text-sm text-ink-muted">
                    {user.driverLicenseRejectionReason}
                  </p>
                )}
              <p className="mt-2 text-sm text-ink-muted">
                You can upload a new licence below.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-5">
          <ol className="space-y-2 text-sm text-ink-muted">
            <li>
              <span className="font-medium text-ink">1.</span> Upload your driving licence — we
              verify it by hand.
            </li>
            <li>
              <span className="font-medium text-ink">2.</span> Add your vehicle and its documents.
            </li>
            <li>
              <span className="font-medium text-ink">3.</span> Publish a ride and start earning.
            </li>
          </ol>

          <div className="border-t border-border-subtle pt-5">
            <FileUpload
              label="Driving licence"
              hint="A clear photo or scan of both sides, or a PDF."
              value={file}
              onChange={setFile}
              disabled={mutation.isPending}
            />
          </div>

          {mutation.error !== undefined && <InlineError error={mutation.error} />}

          <Button
            size="lg"
            className="w-full"
            disabled={file === null}
            loading={mutation.isPending}
            onClick={() => {
              if (file !== null) mutation.mutate(file);
            }}
          >
            Submit for review
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
