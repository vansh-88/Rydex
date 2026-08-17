import {
  BadgeCheck,
  Car,
  IdCard,
  Leaf,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Hero } from '@/features/landing/Hero';

// Deliberately free of invented numbers. No "10,000 riders" or "2.4 tonnes of
// CO₂ saved" — Rydex has no such data, and putting a fabricated figure on the
// front page would be a lie the product cannot back up. Every claim below is
// something the system actually does.
const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Search your route',
    body: 'Tell us where you are going and when. Rydex matches drivers already making that journey, within 10 km of both ends of your trip.',
  },
  {
    icon: BadgeCheck,
    title: 'Pick your driver',
    body: 'See their rating, the car, and how far the ride sits from your own pickup and drop-off before you commit.',
  },
  {
    icon: Wallet,
    title: 'Reserve for a fraction',
    body: 'Pay a small deposit to hold your seat. The rest is only due once the trip is actually finished.',
  },
];

const TRUST = [
  {
    icon: IdCard,
    title: 'Every driver is checked by a person',
    body: 'A driving licence is reviewed by hand before anyone can publish a ride — and again for the car itself, with its registration, insurance and pollution certificate.',
  },
  {
    icon: Star,
    title: 'Ratings go both ways',
    body: 'Drivers rate passengers and passengers rate drivers, once the trip is done. Reputation is earned on both sides of the car.',
  },
  {
    icon: MessageSquare,
    title: 'Agree the details first',
    body: 'Message your driver in the app to settle exactly where to meet, before the day of travel.',
  },
  {
    icon: ShieldCheck,
    title: 'Money handled properly',
    body: 'Payments run through a payment gateway and are only ever confirmed by the gateway itself — never by the app taking your word for it.',
  },
];

// The marketing landing page, for visitors only.
//
// There is no search box here on purpose: searching requires an account
// (GET /rides/search is authenticated), so a form on this page could only ever
// bounce the visitor to login. Signed-in users are sent straight to /search,
// which is the functional home and carries both the search form and anything
// needing their attention.
export function Home() {
  const { status } = useAuth();

  if (status === 'authenticated') return <Navigate to="/search" replace />;

  return (
    <div className="space-y-16 pb-8">
      <Hero />

      <section>
        <h2 className="text-xl font-semibold text-ink">How it works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <Card key={step.title}>
              <CardBody>
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-800">
                    {index + 1}
                  </span>
                  <step.icon className="size-4 text-accent-700" aria-hidden />
                </div>
                <p className="mt-3 font-medium text-ink">{step.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* The environmental case, stated as what carpooling is rather than as a
          metric Rydex cannot measure. */}
      <section>
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Leaf className="size-6 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <h2 className="font-semibold text-ink">Four people, one car</h2>
              <p className="mt-1 text-sm text-ink-muted">
                A car going from Delhi to Jaipur burns the same fuel whether one person is in it or
                four. Filling the empty seats is the rare choice that costs everyone less and puts
                fewer cars on the highway at the same time — no new technology required, just a seat
                that would otherwise travel empty.
              </p>
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-ink">Sharing a car with a stranger</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">
          It only works if it feels safe. Here is what Rydex actually does about that.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TRUST.map((item) => (
            <Card key={item.title}>
              <CardBody className="flex gap-3">
                <item.icon className="mt-0.5 size-5 shrink-0 text-accent-700" aria-hidden />
                <div>
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{item.body}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* The driver pitch is separate and last: most visitors arrive wanting a
          seat, and the funnel to become a driver is long enough that it
          deserves its own explanation rather than a stray link. */}
      <section>
        <Card>
          <CardBody className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <Car className="size-5 text-accent-700" aria-hidden />
                <h2 className="text-xl font-semibold text-ink">Already making the trip?</h2>
              </div>
              <p className="mt-2 text-ink-muted">
                Publish the journey you are taking anyway and sell the seats you are not using.
                Rydex works out a fair fare from your actual route, so you are not guessing what to
                charge. You will need your licence and your car&rsquo;s papers verified first — both
                are reviewed by a person, once.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link to="/login" className={buttonStyles({ size: 'lg' })}>
                Get started
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
