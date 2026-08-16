import { Car, IdCard } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { updateMe } from '@/api/endpoints/auth';
import { useApiMutation } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { RatingDisplay } from '@/components/domain/StarRating';
import { ErrorState, InlineError } from '@/components/domain/States';
import { StatusPill } from '@/components/domain/StatusPill';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { DRIVER_LICENSE_STATUS } from '@/lib/statusMaps';

export function Profile() {
  const { user, refreshUser, signOut, isDriver } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation(updateMe, {
    onSuccess: () => {
      toast('Profile updated.', 'success');
      void refreshUser();
    },
  });

  // RequireAuth guarantees a session, but the profile fetch can still have
  // failed (AuthProvider keeps the session rather than signing the user out
  // over a transient error). Rendering nothing would leave a blank page with
  // no way forward, so offer the retry instead.
  if (user === null) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <ErrorState
          error={undefined}
          onRetry={() => {
            void refreshUser();
          }}
        />
      </div>
    );
  }

  const dirty = name !== user.name || phone !== user.phone;

  function save() {
    const next: Record<string, string> = {};
    if (name.trim().length === 0) next.name = 'Enter your name';
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      next.phone = 'Include the country code, e.g. +919876543210';
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    mutation.mutate({ name: name.trim(), phone: phone.trim() });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-700 text-lg font-medium text-white">
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-medium text-ink">{user.name}</p>
              <p className="text-sm text-ink-muted">{user.email}</p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          {/* Two separate reputations. The backend keeps them in different
              columns because being a good passenger says nothing about being
              a good driver, and collapsing them would hide that. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-xs text-ink-muted">As a passenger</p>
              <div className="mt-1">
                <RatingDisplay rating={user.passengerRatingAverage} count={user.passengerRatingCount} />
              </div>
            </div>
            <div className="rounded-lg bg-canvas p-3">
              <p className="text-xs text-ink-muted">As a driver</p>
              <div className="mt-1">
                <RatingDisplay rating={user.driverRatingAverage} count={user.driverRatingCount} />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-border-subtle pt-4">
            <Field label="Name" error={errors.name}>
              {({ id }) => (
                <TextInput
                  id={id}
                  invalid={errors.name !== undefined}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              )}
            </Field>
            <Field label="Phone" error={errors.phone}>
              {({ id }) => (
                <TextInput
                  id={id}
                  invalid={errors.phone !== undefined}
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                  }}
                />
              )}
            </Field>

            {mutation.error !== undefined && <InlineError error={mutation.error} />}

            <Button disabled={!dirty} loading={mutation.isPending} onClick={save}>
              Save changes
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IdCard className="size-4 text-ink-faint" aria-hidden />
            <p className="font-medium text-ink">Driving</p>
          </div>
          <StatusPill status={user.driverLicenseStatus} map={DRIVER_LICENSE_STATUS} />
        </CardHeader>
        <CardBody className="space-y-3">
          {isDriver ? (
            <>
              <p className="text-sm text-ink-muted">
                You can publish rides with any verified vehicle.
              </p>
              <Link to="/vehicles" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                <Car className="size-4" aria-hidden />
                My vehicles
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                Drivers publish trips they&rsquo;re already making and sell the empty seats.
              </p>
              <Link
                to="/become-a-driver"
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                Become a driver
              </Link>
            </>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void signOut(true);
          }}
        >
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
