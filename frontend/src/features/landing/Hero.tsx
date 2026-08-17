import { Leaf, Sprout, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { buttonStyles } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

// Drop a wide image at frontend/public/hero.jpg to use a photograph here.
// Until then the gradient below stands in — the layout is designed to look
// deliberate either way rather than showing a broken image.
const HERO_IMAGE = '/hero.jpg';

// The floating card is an illustration of a driver's profile, not a live
// figure: Rydex does not track emissions, and a visitor who is not signed in
// has no rating. It is labelled as an example so the design reads as a product
// mock rather than a claim the product cannot substantiate.
const EXAMPLE_STATS = [
  { icon: Sprout, label: 'Reduced emissions', value: '1.2 tons CO₂' },
  { icon: Star, label: 'Reputation score', value: '4.8 / 5' },
];

export function Hero() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-accent-900 via-accent-800 to-emerald-900">
      {!imageFailed && (
        <img
          src={HERO_IMAGE}
          // Decorative: the headline beside it already carries the meaning, so
          // announcing the photo would only add noise for a screen reader.
          alt=""
          onError={() => {
            setImageFailed(true);
          }}
          // Largest above-the-fold element, so it is the LCP candidate —
          // telling the browser that gets it fetched ahead of lower-priority
          // requests instead of queued behind them.
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Keeps the headline readable over an arbitrary photograph — the image
          is the user's to choose, so contrast cannot be assumed. Heavier on
          the left, where the text sits. */}
      <div
        aria-hidden
        className={cn(
          // Narrow screens: darken broadly, because the text spans the full
          // width and can land over any part of the photo.
          'absolute inset-0 bg-slate-950/70',
          // Wide screens: weight it left, where the copy actually is, so more
          // of the photograph stays visible on the right.
          'lg:bg-gradient-to-r lg:from-slate-950/90 lg:via-slate-950/65 lg:to-slate-950/20',
        )}
      />

      <div className="relative grid min-h-[26rem] gap-8 p-6 sm:p-10 lg:min-h-[30rem] lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:p-14">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-emerald-100 backdrop-blur">
            <Leaf className="size-3.5" aria-hidden />
            Sustainable commuting
          </p>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Rydex: sustainable commuting for the conscious commuter
          </h1>
          <p className="mt-4 text-base text-slate-200 sm:text-lg">
            Travel the route you were taking anyway, with people going the same way. Fewer cars, a
            cheaper trip, and a seat that would otherwise have gone empty.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/login" className={buttonStyles({ size: 'lg' })}>
              Find a ride
            </Link>
            <Link
              to="/login"
              className={cn(
                buttonStyles({ size: 'lg' }),
                // Not the `secondary` variant: that is designed for a white
                // page and disappears against a photograph.
                'border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20',
              )}
            >
              Offer a ride
            </Link>
          </div>

          <p className="mt-3 text-sm text-slate-300">
            No password — we email you a code to sign in.
          </p>
        </div>

        <div className="w-full max-w-xs rounded-card border border-white/20 bg-white/95 p-4 shadow-lg backdrop-blur lg:w-72">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              <Leaf className="size-3.5" aria-hidden />
              Eco-leader status
            </p>
            {/* Stated plainly rather than in fine print: these are not this
                visitor's numbers, and implying otherwise would be a lie. */}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Example
            </span>
          </div>

          <dl className="mt-3 space-y-2.5">
            {EXAMPLE_STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2.5">
                <stat.icon className="size-4 shrink-0 text-accent-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-ink-muted">{stat.label}</dt>
                  <dd className="text-sm font-semibold text-ink">{stat.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <p className="mt-3 border-t border-border-subtle pt-3 text-xs text-ink-muted">
            Every trip you share builds a rating both drivers and passengers can see.
          </p>
        </div>
      </div>
    </section>
  );
}
