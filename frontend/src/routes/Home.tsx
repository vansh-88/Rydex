import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { SearchForm } from '@/features/search/SearchForm';
import { criteriaToSearchParams, type SearchCriteria } from '@/features/search/searchParams';
import { UpNext } from '@/features/trips/UpNext';

export function Home() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  function handleSearch(criteria: SearchCriteria) {
    const search = `?${criteriaToSearchParams(criteria).toString()}`;

    // GET /rides/search requires authentication, so an anonymous visitor
    // cannot run this query. Rather than blocking the form up front — a real
    // search is a far better reason to sign up than a bare "Sign in" button —
    // the criteria are carried through login and executed on arrival.
    if (status !== 'authenticated') {
      navigate('/login', { state: { from: { pathname: '/search', search } } });
      return;
    }

    navigate(`/search${search}`);
  }

  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {status === 'authenticated'
            ? `Where to, ${user?.name.split(' ')[0] ?? 'there'}?`
            : 'Share the ride, split the cost'}
        </h1>
        <p className="mt-2 text-ink-muted">
          Rydex connects you with drivers already making your journey.
        </p>
      </div>

      <div className="mt-8 rounded-card border border-border-subtle bg-surface p-4 sm:p-6">
        <SearchForm onSubmit={handleSearch} />
      </div>

      <p className="mt-3 text-sm text-ink-faint">
        Rides are matched within 10 km of both your pickup and your destination, on the date you
        choose.
      </p>

      {status === 'authenticated' && <UpNext />}
    </div>
  );
}
