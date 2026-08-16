import { SearchX, SlidersHorizontal } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { searchRides } from '@/api/endpoints/rides';
import { usePaginatedQuery } from '@/api/hooks';
import { EmptyState, ErrorState } from '@/components/domain/States';
import { Button } from '@/components/ui/Button';
import { SelectInput } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { RideResultCard } from '@/features/search/RideResultCard';
import { SearchForm } from '@/features/search/SearchForm';
import {
  criteriaToQuery,
  criteriaToSearchParams,
  parseSearchCriteria,
  SORT_OPTIONS,
  type SearchCriteria,
} from '@/features/search/searchParams';
import { formatDay } from '@/lib/kolkataDate';
import type { RideSearchSort } from '@/api/types';

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const criteria = parseSearchCriteria(searchParams);

  // Keyed on everything that changes the query. A new key resets the
  // accumulated pages, which matters because the backend rejects a cursor
  // created under a different sort (INVALID_CURSOR).
  const key =
    criteria === null
      ? null
      : `rides/search:${criteria.date}:${String(criteria.from.latitude)},${String(
          criteria.from.longitude,
        )}:${String(criteria.to.latitude)},${String(criteria.to.longitude)}:${criteria.sort}`;

  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) => {
      if (criteria === null) return Promise.resolve({ items: [], nextCursor: null });
      return searchRides({ ...criteriaToQuery(criteria), cursor }, signal);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const { items, error, isLoading, isLoadingMore, hasMore, loadMore, reload } = usePaginatedQuery(
    key,
    fetchPage,
  );

  function applyCriteria(next: SearchCriteria) {
    setSearchParams(criteriaToSearchParams(next));
  }

  if (criteria === null) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <h1 className="text-2xl font-semibold text-ink">Find a ride</h1>
        <p className="mt-1 text-ink-muted">Tell us where you&rsquo;re going.</p>
        <div className="mt-6 rounded-card border border-border-subtle bg-surface p-4 sm:p-6">
          <SearchForm
            onSubmit={(next) => {
              navigate(`/search?${criteriaToSearchParams(next).toString()}`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border-subtle bg-surface p-4">
        <SearchForm initial={criteria} onSubmit={applyCriteria} compact />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">
            {criteria.from.label.split(',')[0]} → {criteria.to.label.split(',')[0]}
          </h1>
          <p className="text-sm text-ink-muted">
            {formatDay(`${criteria.date}T00:00:00+05:30`)}
            {items.length > 0 && ` · ${String(items.length)} ride${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <SelectInput
            value={criteria.sort}
            onChange={(event) => {
              applyCriteria({ ...criteria, sort: event.target.value as RideSearchSort });
            }}
            className="h-9 w-auto"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </label>
      </div>

      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && error !== undefined && items.length === 0 && (
        <ErrorState error={error} onRetry={reload} />
      )}

      {!isLoading && error === undefined && items.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No rides on this route yet"
          // The constraints are unusual enough that a bare "no results" would
          // read as a broken product rather than an empty corridor.
          description="Rydex matches rides within 10 km of both your pickup and your destination, on the exact date you picked. Try a nearby landmark, or a different day."
        />
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((ride) => (
              <RideResultCard key={ride.id} ride={ride} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" loading={isLoadingMore} onClick={loadMore}>
                Show more rides
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
