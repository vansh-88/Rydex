import { ArrowLeft, Clock, IdCard, Info, Route } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { createRide, getRide, previewRide, type CreateRideInput } from '@/api/endpoints/rides';
import { listVehicles } from '@/api/endpoints/vehicles';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { Ride, RidePreview, Vehicle } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Fare, PostingFeeBreakdown } from '@/components/domain/Fare';
import { LazyRouteMap } from '@/components/domain/LazyRouteMap';
import { PlaceInput, type PlaceValue } from '@/components/domain/PlaceInput';
import { EmptyState, InlineError } from '@/components/domain/States';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, SelectInput, TextInput } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { PaymentStatus } from '@/features/payment/PaymentStatus';
import { usePaymentFlow } from '@/features/payment/usePaymentFlow';
import { clearIdempotencyKey, idempotencyKeyFor } from '@/lib/idempotency';
import { formatDuration } from '@/lib/money';

type Step = 'form' | 'preview';

interface FormState {
  from: PlaceValue | null;
  to: PlaceValue | null;
  date: string;
  time: string;
  vehicleId: string;
  seats: string;
}

// Publishing a ride costs the driver a 5% posting commission, and the ride
// stays invisible until it is paid. That makes this flow different from every
// other "create" screen in the product: the fee has to be visible and
// explained *before* the driver commits, which is what the preview step is
// for.
export function OfferRide() {
  const navigate = useNavigate();
  const { isDriver } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormState>({
    from: null,
    to: null,
    date: '',
    time: '',
    vehicleId: '',
    seats: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<RidePreview | null>(null);

  const { data: vehicles, isLoading: vehiclesLoading } = useApiQuery(
    isDriver ? 'vehicles' : null,
    useCallback((signal: AbortSignal) => listVehicles(signal), []),
  );

  // Only a VERIFIED, ACTIVE vehicle with enough seats can carry a ride — the
  // backend rejects anything else with VEHICLE_NOT_ELIGIBLE, so offering the
  // others in the picker would only produce a confusing failure.
  const eligibleVehicles = (vehicles?.items ?? []).filter(
    (vehicle) => vehicle.verificationStatus === 'VERIFIED' && vehicle.status === 'ACTIVE',
  );

  const previewMutation = useApiMutation(
    (input: CreateRideInput) => previewRide(input),
    {
      onSuccess: (result) => {
        setPreview(result);
        setStep('preview');
      },
    },
  );

  if (!isDriver) {
    return (
      <EmptyState
        icon={IdCard}
        title="Only verified drivers can publish rides"
        description="Submit your driving licence for verification. Once it's approved, add a vehicle and you can start publishing."
        action={
          <Link to="/become-a-driver" className={buttonStyles()}>
            Become a driver
          </Link>
        }
        className="my-12"
      />
    );
  }

  if (vehiclesLoading) return <ListSkeleton rows={2} />;

  if (eligibleVehicles.length === 0) {
    return (
      <EmptyState
        icon={IdCard}
        title="You need a verified vehicle first"
        description="Add a vehicle and upload its RC, insurance and pollution certificate. Once a reviewer verifies it, you can publish rides."
        action={
          <Link to="/vehicles" className={buttonStyles()}>
            My vehicles
          </Link>
        }
        className="my-12"
      />
    );
  }

  function buildInput(): CreateRideInput | null {
    if (form.from === null || form.to === null) return null;

    return {
      origin: { latitude: form.from.latitude, longitude: form.from.longitude },
      originAddress: form.from.label.slice(0, 300),
      destination: { latitude: form.to.latitude, longitude: form.to.longitude },
      destinationAddress: form.to.label.slice(0, 300),
      // The backend requires a future instant. Combining the local date and
      // time inputs and letting Date serialise to UTC keeps the driver's
      // wall-clock intent intact.
      departureTime: new Date(`${form.date}T${form.time}`).toISOString(),
      vehicleId: form.vehicleId,
      availableSeats: Number(form.seats),
    };
  }

  function goToPreview() {
    const next: Record<string, string> = {};
    if (form.from === null) next.from = 'Pick a place from the list';
    if (form.to === null) next.to = 'Pick a place from the list';
    if (form.date.length === 0) next.date = 'Choose a date';
    if (form.time.length === 0) next.time = 'Choose a time';
    if (form.vehicleId.length === 0) next.vehicleId = 'Choose a vehicle';

    const seats = Number(form.seats);
    const vehicle = eligibleVehicles.find((item) => item.id === form.vehicleId);
    if (!Number.isInteger(seats) || seats < 1) {
      next.seats = 'How many seats are you selling?';
    } else if (vehicle !== undefined && seats > vehicle.seatCapacity) {
      next.seats = `That vehicle seats ${String(vehicle.seatCapacity)}`;
    }

    if (form.date.length > 0 && form.time.length > 0) {
      if (new Date(`${form.date}T${form.time}`).getTime() <= Date.now()) {
        next.time = 'Departure must be in the future';
      }
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    const input = buildInput();
    if (input !== null) previewMutation.mutate(input);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {step === 'preview' && preview !== null ? (
        <PreviewStep
          preview={preview}
          input={buildInput()}
          vehicle={eligibleVehicles.find((item) => item.id === form.vehicleId)}
          onBack={() => {
            setStep('form');
          }}
          onPublished={(ride) => {
            void navigate(`/rides/${ride.id}/manage`);
          }}
        />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Offer a ride</h1>
            <p className="mt-1 text-ink-muted">
              Publish a trip you&rsquo;re already making and sell the empty seats.
            </p>
          </div>

          <Card>
            <CardBody className="space-y-4">
              <Field label="Leaving from" error={errors.from} required>
                {({ id, describedBy }) => (
                  <PlaceInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={errors.from !== undefined}
                    value={form.from}
                    onChange={(value) => {
                      setForm({ ...form, from: value });
                    }}
                    placeholder="Connaught Place, Delhi"
                  />
                )}
              </Field>

              <Field label="Going to" error={errors.to} required>
                {({ id, describedBy }) => (
                  <PlaceInput
                    id={id}
                    aria-describedby={describedBy}
                    invalid={errors.to !== undefined}
                    value={form.to}
                    onChange={(value) => {
                      setForm({ ...form, to: value });
                    }}
                    placeholder="Jaipur, Rajasthan"
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" error={errors.date} required>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      invalid={errors.date !== undefined}
                      type="date"
                      value={form.date}
                      onChange={(event) => {
                        setForm({ ...form, date: event.target.value });
                      }}
                    />
                  )}
                </Field>
                <Field label="Departure time" error={errors.time} required>
                  {({ id }) => (
                    <TextInput
                      id={id}
                      invalid={errors.time !== undefined}
                      type="time"
                      value={form.time}
                      onChange={(event) => {
                        setForm({ ...form, time: event.target.value });
                      }}
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vehicle" error={errors.vehicleId} required>
                  {({ id }) => (
                    <SelectInput
                      id={id}
                      invalid={errors.vehicleId !== undefined}
                      value={form.vehicleId}
                      onChange={(event) => {
                        setForm({ ...form, vehicleId: event.target.value });
                      }}
                    >
                      <option value="">Choose a vehicle</option>
                      {eligibleVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} · {vehicle.registrationNumber}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>

                <Field
                  label="Seats for sale"
                  error={errors.seats}
                  hint="Not counting yourself."
                  required
                >
                  {({ id, describedBy }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={errors.seats !== undefined}
                      type="number"
                      min={1}
                      max={20}
                      placeholder="3"
                      value={form.seats}
                      onChange={(event) => {
                        setForm({ ...form, seats: event.target.value });
                      }}
                    />
                  )}
                </Field>
              </div>

              {previewMutation.error !== undefined && (
                <InlineError error={previewMutation.error} />
              )}

              {/* Said here as well as on the preview: a driver should never be
                  surprised by the fee, and this is the first screen where the
                  cost of publishing is relevant. */}
              <div className="flex items-start gap-2 rounded-lg bg-canvas p-3 text-sm text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
                <span>
                  We&rsquo;ll calculate the fare from your route. Publishing costs a small posting
                  fee — you&rsquo;ll see the exact amount before you pay anything.
                </span>
              </div>

              <Button
                size="lg"
                className="w-full"
                loading={previewMutation.isPending}
                onClick={goToPreview}
              >
                See fare and fee
              </Button>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function PreviewStep({
  preview,
  input,
  vehicle,
  onBack,
  onPublished,
}: {
  preview: RidePreview;
  input: CreateRideInput | null;
  vehicle: Vehicle | undefined;
  onBack: () => void;
  onPublished: (ride: Ride) => void;
}) {
  // Keyed on the actual route and departure, so retrying after a failed
  // payment replays the same request rather than publishing twice — but
  // changing any detail is correctly treated as a new ride.
  const intent =
    input === null
      ? 'publish:unknown'
      : `publish:${input.vehicleId}:${input.departureTime}:${String(input.availableSeats)}` +
        `:${String(input.origin.latitude)},${String(input.origin.longitude)}`;

  const flow = usePaymentFlow<Ride>({
    createOrder: async () => {
      if (input === null) throw new Error('Missing ride details');
      const result = await createRide(input, idempotencyKeyFor(intent));
      return { order: result.paymentOrder, entityId: result.ride.id, entity: result.ride };
    },
    pollEntity: (rideId, signal) => getRide(rideId, signal),
    // The posting-commission webhook is what moves the ride out of
    // PENDING_PAYMENT and makes it visible in search.
    isSettled: (ride) => ride.status === 'OPEN',
    description: 'Ride posting fee',
    invalidates: ['rides/mine', 'rides'],
  });

  useEffect(() => {
    if (flow.phase === 'succeeded') clearIdempotencyKey(intent);
  }, [flow.phase, intent]);

  const published = flow.entity;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={flow.phase !== 'idle'}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Edit details
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-ink">Review and publish</h1>
        <p className="mt-1 text-ink-muted">
          Nothing is published until the posting fee is paid.
        </p>
      </div>

      <LazyRouteMap
        geometry={preview.routeGeometry}
        points={
          input === null
            ? []
            : [
                {
                  latitude: input.origin.latitude,
                  longitude: input.origin.longitude,
                  label: input.originAddress ?? 'Start',
                  kind: 'origin',
                },
                {
                  latitude: input.destination.latitude,
                  longitude: input.destination.longitude,
                  label: input.destinationAddress ?? 'End',
                  kind: 'destination',
                },
              ]
        }
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Route className="size-4" aria-hidden />
          {(preview.distanceMeters / 1000).toFixed(0)} km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden />
          {formatDuration(preview.durationSeconds)}
        </span>
        {vehicle !== undefined && (
          <span>
            {vehicle.make} {vehicle.model} · {vehicle.registrationNumber}
          </span>
        )}
      </div>

      <Card>
        <CardBody>
          <PostingFeeBreakdown
            farePerSeat={preview.farePerSeat}
            totalSeats={preview.totalSeats}
            commissionAmount={preview.postingCommissionAmount}
          />
        </CardBody>
      </Card>

      <PaymentStatus
        phase={flow.phase}
        error={flow.error}
        isStub={flow.isStub}
        onRetry={flow.start}
        successTitle="Your ride is live"
        successBody="Passengers can now find and book seats on it."
        successAction={
          published !== undefined ? (
            <Button
              onClick={() => {
                onPublished(published);
              }}
            >
              Manage this ride
            </Button>
          ) : undefined
        }
      />

      {flow.phase === 'idle' && (
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={flow.start}>
            Pay <Fare amount={preview.postingCommissionAmount} size="sm" /> and publish
          </Button>
          <p className="text-center text-xs text-ink-faint">
            Your ride won&rsquo;t appear in search until this is paid. Cancel more than 18 hours
            before departure and part of the fee is refunded.
          </p>
        </div>
      )}
    </>
  );
}
