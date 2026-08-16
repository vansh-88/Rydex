import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { buttonStyles } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

// Phase 2 version: enough of a landing page to exercise the shell and the
// signed-in/anonymous split. The real search form (From / To / Date, backed by
// place autocomplete) and the signed-in obligations list arrive in Phase 3
// and Phase 5.
export function Home() {
  const { status, user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        {status === 'authenticated' ? `Welcome back, ${user?.name.split(' ')[0] ?? ''}` : 'Share the ride'}
      </h1>
      <p className="mt-2 text-ink-muted">
        Rydex matches you with drivers already making your journey, and splits the cost.
      </p>

      <Card className="mt-8">
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-muted">
            The search form lands in Phase 3, along with place autocomplete and results.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/search" className={buttonStyles()}>
              Find a ride
            </Link>
            <Link to="/offer" className={buttonStyles({ variant: 'secondary' })}>
              Offer a ride
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
