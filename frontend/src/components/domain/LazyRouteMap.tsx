import { lazy, Suspense } from 'react';

import { Skeleton } from '@/components/ui/Skeleton';

import type { MapPoint } from './RouteMap';

// Leaflet plus its stylesheet is the single largest dependency in the app, and
// only two screens use a map (ride detail, and the offer-a-ride preview).
// Splitting it here keeps it out of the initial bundle, so search, trips and
// the whole driver funnel never pay for it.
const RouteMap = lazy(async () => {
  const module = await import('./RouteMap');
  return { default: module.RouteMap };
});

export type { MapPoint };

export function LazyRouteMap(props: React.ComponentProps<typeof RouteMap>) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-card sm:h-80" />}>
      <RouteMap {...props} />
    </Suspense>
  );
}
