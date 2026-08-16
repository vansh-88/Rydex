import { CarFront, SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { Countdown } from '@/components/domain/Countdown';
import { Fare, FareBreakdown, PostingFeeBreakdown } from '@/components/domain/Fare';
import { RatingDisplay, StarInput } from '@/components/domain/StarRating';
import { EmptyState, ErrorState, InlineError } from '@/components/domain/States';
import { StatusHint, StatusPill } from '@/components/domain/StatusPill';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, SelectInput, Textarea, TextInput } from '@/components/ui/Input';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl, TabPanel, Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  BOOKING_STATUS,
  DRIVER_LICENSE_STATUS,
  RIDE_STATUS,
  VERIFICATION_STATUS,
} from '@/lib/statusMaps';
import { formatDeparture, formatRelativeToNow } from '@/lib/kolkataDate';
import { formatDistanceKm, formatDuration } from '@/lib/money';

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {note !== undefined && <p className="mt-0.5 text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const DEPARTURE = new Date(Date.now() + 3 * 86_400_000).toISOString();
const HOLD_STARTED = new Date(Date.now() - 13 * 60_000).toISOString();
const HOLD_ALMOST_UP = new Date(Date.now() - 14 * 60_000 - 20_000).toISOString();
const HOLD_EXPIRED = new Date(Date.now() - 20 * 60_000).toISOString();

// Not a route users ever see — a single page rendering every primitive in
// every state, so regressions in the design system are visible without
// clicking through the whole product. Verified at 1440 / 768 / 375.
export function KitchenSink() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [score, setScore] = useState(4);
  const [tab, setTab] = useState('upcoming');
  const [role, setRole] = useState<'riding' | 'driving'>('riding');

  return (
    <div className="mx-auto max-w-300 space-y-12 px-4 py-10 sm:px-6">
      <header className="border-b border-border-subtle pb-6">
        <h1 className="text-2xl font-semibold text-ink">Rydex design system</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every primitive in every state. Check this at 1440, 768 and 375 px.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Book this seat</Button>
          <Button variant="secondary">View details</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Cancel booking</Button>
          <Button loading>Publishing</Button>
          <Button disabled>Unavailable</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Leaving from" required>
            {({ id, describedBy }) => (
              <TextInput id={id} aria-describedby={describedBy} placeholder="Connaught Place" />
            )}
          </Field>
          <Field label="Email" error="Enter a valid email address">
            {({ id, describedBy }) => (
              <TextInput id={id} aria-describedby={describedBy} invalid defaultValue="not-an-email" />
            )}
          </Field>
          <Field label="Sort by" hint="Nearest pickup first is usually most useful.">
            {({ id, describedBy }) => (
              <SelectInput id={id} aria-describedby={describedBy} defaultValue="PICKUP_DISTANCE">
                <option value="DEPARTURE_TIME">Departure time</option>
                <option value="PICKUP_DISTANCE">Nearest pickup</option>
                <option value="FARE">Lowest fare</option>
              </SelectInput>
            )}
          </Field>
          <Field label="Seats" required>
            {({ id }) => <TextInput id={id} type="number" defaultValue={2} min={1} max={4} />}
          </Field>
          <Field label="Disabled">
            {({ id }) => <TextInput id={id} disabled defaultValue="DL01AB1234" />}
          </Field>
          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Comment" hint="Optional, up to 1000 characters.">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} placeholder="How was the trip?" />
              )}
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Status pills"
        note="6 ride statuses and 5 booking statuses, rendered through one component."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.keys(RIDE_STATUS).map((status) => (
              <StatusPill key={status} status={status} map={RIDE_STATUS} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(BOOKING_STATUS).map((status) => (
              <StatusPill key={status} status={status} map={BOOKING_STATUS} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(VERIFICATION_STATUS).map((status) => (
              <StatusPill key={status} status={status} map={VERIFICATION_STATUS} />
            ))}
            <StatusPill status="NONE" map={DRIVER_LICENSE_STATUS} />
            <StatusPill status="SOME_FUTURE_ENUM" map={RIDE_STATUS} />
          </div>
          <StatusHint status="PENDING_PAYMENT" map={RIDE_STATUS} />
        </div>
      </Section>

      <Section title="Money" note="The 10/90 split is never collapsed into a single total.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-medium text-ink">Passenger — booking</h3>
            </CardHeader>
            <CardBody>
              <FareBreakdown farePerSeat={425} seatCount={2} totalFare={850} prepaidAmount={85} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="font-medium text-ink">Driver — publishing</h3>
            </CardHeader>
            <CardBody>
              <PostingFeeBreakdown farePerSeat={425} totalSeats={4} commissionAmount={85} />
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-wrap items-baseline gap-6">
          <Fare amount={2815} size="lg" />
          <Fare amount={850} />
          <Fare amount={85} size="sm" />
          <span className="text-sm text-ink-muted">
            {formatDistanceKm(2.3)} · {formatDistanceKm(0.7)} · {formatDuration(19_200)}
          </span>
        </div>
      </Section>

      <Section title="Seat-hold countdown" note="The 15-minute fuse on an unpaid booking.">
        <div className="flex flex-col gap-2">
          <Countdown createdAt={HOLD_STARTED} />
          <Countdown createdAt={HOLD_ALMOST_UP} />
          <Countdown createdAt={HOLD_EXPIRED} />
        </div>
      </Section>

      <Section title="Ratings" note="Aggregates only — the API cannot supply a review history.">
        <div className="flex flex-wrap items-center gap-6">
          <RatingDisplay rating={4.8} count={23} />
          <RatingDisplay rating={5} count={1} />
          <RatingDisplay rating={null} />
        </div>
        <StarInput value={score} onChange={setScore} />
      </Section>

      <Section title="Navigation">
        <SegmentedControl
          aria-label="Trip role"
          value={role}
          onValueChange={setRole}
          options={[
            { value: 'riding', label: 'Riding' },
            { value: 'driving', label: 'Driving' },
          ]}
        />
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'upcoming', label: 'Upcoming', count: 2 },
            { value: 'past', label: 'Past' },
          ]}
        >
          <TabPanel value="upcoming" className="pt-4">
            <Card>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-ink-muted">
                      {formatDeparture(DEPARTURE)} · {formatRelativeToNow(DEPARTURE)}
                    </p>
                    <p className="mt-1 font-medium text-ink">Connaught Place → Jaipur</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Rohit S. · Swift Dzire · 2 seats
                    </p>
                  </div>
                  <StatusPill status="CONFIRMED" map={BOOKING_STATUS} />
                </div>
              </CardBody>
              <CardFooter className="justify-end">
                <Button variant="secondary" size="sm">
                  Message driver
                </Button>
                <Button size="sm">View trip</Button>
              </CardFooter>
            </Card>
          </TabPanel>
          <TabPanel value="past" className="pt-4">
            <EmptyState
              icon={CarFront}
              title="No past trips yet"
              description="Trips you have completed will appear here."
            />
          </TabPanel>
        </Tabs>
      </Section>

      <Section title="Loading">
        <ListSkeleton rows={2} />
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title="Empty and error states">
        <EmptyState
          icon={SearchX}
          title="No rides on this route yet"
          description="Rydex matches rides within 10 km of both your pickup and your destination, on the exact day you picked. Try a nearby landmark or a different date."
          action={<Button variant="secondary">Change search</Button>}
        />
        <ErrorState
          error={
            new ApiError(404, 'RIDE_NOT_FOUND', 'Ride not found', 'req_5f1c8a2e-77d1-4a0b-9c3e')
          }
          onRetry={() => {
            toast('Retried', 'info');
          }}
        />
        <InlineError error={new ApiError(409, 'NO_SEATS_AVAILABLE', 'No seats')} />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Open cancel dialog
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              toast('Your seat is confirmed.', 'success');
            }}
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              toast('Those seats were just taken. Try a different ride.', 'error');
            }}
          >
            Error toast
          </Button>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Cancel this booking?"
          description="This cannot be undone."
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                Keep booking
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDialogOpen(false);
                  toast('Booking cancelled.', 'info');
                }}
              >
                Cancel booking
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            You&rsquo;ll lose the <Fare amount={85} size="sm" /> you already paid. The remaining{' '}
            <Fare amount={765} size="sm" /> was never charged.
          </p>
        </Dialog>
      </Section>
    </div>
  );
}
