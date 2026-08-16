import { Car, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { createVehicle, listVehicles } from '@/api/endpoints/vehicles';
import { useApiMutation, useApiQuery } from '@/api/hooks';
import type { VehicleType } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, ErrorState, InlineError } from '@/components/domain/States';
import { StatusPill } from '@/components/domain/StatusPill';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, SelectInput, TextInput } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { VERIFICATION_STATUS } from '@/lib/statusMaps';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'HATCHBACK', label: 'Hatchback' },
  { value: 'SEDAN', label: 'Sedan' },
  { value: 'SUV', label: 'SUV' },
  { value: 'MUV', label: 'MUV' },
];

export function Vehicles() {
  const { isDriver } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  const { data, error, isLoading, refetch } = useApiQuery(
    'vehicles',
    useCallback((signal: AbortSignal) => listVehicles(signal), []),
  );

  // Only a DRIVER may create a vehicle (authorize('DRIVER') on the backend),
  // so a passenger who reaches this page is sent back through the funnel
  // rather than shown a form that will 403.
  if (!isDriver) {
    return (
      <EmptyState
        icon={Car}
        title="Only verified drivers can add a vehicle"
        description="Submit your driving licence first. Once it's approved you can add a vehicle and publish rides."
        action={
          <Link to="/become-a-driver" className={buttonStyles()}>
            Become a driver
          </Link>
        }
        className="my-12"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">My vehicles</h1>
          <p className="mt-1 text-sm text-ink-muted">
            A vehicle must be verified before you can publish a ride with it.
          </p>
        </div>
        <Button
          onClick={() => {
            setAddOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add vehicle
        </Button>
      </div>

      {isLoading && <ListSkeleton rows={2} />}
      {!isLoading && error !== undefined && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && error === undefined && data !== undefined && data.items.length === 0 && (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          description="Add the car you'll be driving, then upload its RC, insurance and pollution certificate for verification."
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((vehicle) => (
            <Card key={vehicle.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">
                      {vehicle.make} {vehicle.model}
                    </p>
                    <StatusPill status={vehicle.verificationStatus} map={VERIFICATION_STATUS} />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {vehicle.registrationNumber}
                    <span className="text-ink-faint">
                      {' '}
                      · {vehicle.seatCapacity} seats · {vehicle.isAc ? 'AC' : 'Non-AC'}
                    </span>
                  </p>
                  {vehicle.verificationStatus === 'REJECTED' &&
                    vehicle.rejectionReason !== null && (
                      <p className="mt-1.5 text-sm text-red-700">{vehicle.rejectionReason}</p>
                    )}
                </div>
                <Link
                  to={`/vehicles/${vehicle.id}`}
                  className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                >
                  Documents
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddVehicleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          refetch();
        }}
      />
    </div>
  );
}

function AddVehicleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    registrationNumber: '',
    make: '',
    model: '',
    seatCapacity: '4',
    vehicleType: 'SEDAN' as VehicleType,
    isAc: 'true',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation(createVehicle, {
    invalidates: ['vehicles'],
    onSuccess: () => {
      toast('Vehicle added. Upload its documents next.', 'success');
      onOpenChange(false);
      setForm({
        registrationNumber: '',
        make: '',
        model: '',
        seatCapacity: '4',
        vehicleType: 'SEDAN',
        isAc: 'true',
      });
      onCreated();
    },
  });

  function submit() {
    const next: Record<string, string> = {};
    // Backend rules: 4-20 chars, letters/digits/spaces/hyphens only.
    if (!/^[A-Za-z0-9 -]{4,20}$/.test(form.registrationNumber.trim())) {
      next.registrationNumber = 'Enter a valid registration number';
    }
    if (form.make.trim().length === 0) next.make = 'Enter the make';
    if (form.model.trim().length === 0) next.model = 'Enter the model';

    const seats = Number(form.seatCapacity);
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      next.seatCapacity = 'Between 1 and 20';
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    mutation.mutate({
      registrationNumber: form.registrationNumber.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      seatCapacity: seats,
      vehicleType: form.vehicleType,
      isAc: form.isAc === 'true',
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={mutation.isPending ? () => undefined : onOpenChange}
      title="Add a vehicle"
      description="You can upload its documents once it's added."
      footer={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={submit}>
            Add vehicle
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Registration number"
          error={errors.registrationNumber}
          hint="This cannot be changed later — it's what gets verified."
          required
        >
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={errors.registrationNumber !== undefined}
              placeholder="DL01AB1234"
              value={form.registrationNumber}
              onChange={(event) => {
                setForm({ ...form, registrationNumber: event.target.value.toUpperCase() });
              }}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make" error={errors.make} required>
            {({ id }) => (
              <TextInput
                id={id}
                invalid={errors.make !== undefined}
                placeholder="Maruti"
                value={form.make}
                onChange={(event) => {
                  setForm({ ...form, make: event.target.value });
                }}
              />
            )}
          </Field>
          <Field label="Model" error={errors.model} required>
            {({ id }) => (
              <TextInput
                id={id}
                invalid={errors.model !== undefined}
                placeholder="Swift Dzire"
                value={form.model}
                onChange={(event) => {
                  setForm({ ...form, model: event.target.value });
                }}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" required>
            {({ id }) => (
              <SelectInput
                id={id}
                value={form.vehicleType}
                onChange={(event) => {
                  setForm({ ...form, vehicleType: event.target.value as VehicleType });
                }}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label="Total seats" error={errors.seatCapacity} required>
            {({ id }) => (
              <TextInput
                id={id}
                invalid={errors.seatCapacity !== undefined}
                type="number"
                min={1}
                max={20}
                value={form.seatCapacity}
                onChange={(event) => {
                  setForm({ ...form, seatCapacity: event.target.value });
                }}
              />
            )}
          </Field>
          <Field label="Air conditioning">
            {({ id }) => (
              <SelectInput
                id={id}
                value={form.isAc}
                onChange={(event) => {
                  setForm({ ...form, isAc: event.target.value });
                }}
              >
                <option value="true">AC</option>
                <option value="false">Non-AC</option>
              </SelectInput>
            )}
          </Field>
        </div>

        {mutation.error !== undefined && <InlineError error={mutation.error} />}
      </div>
    </Dialog>
  );
}
