import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/domain/States';
import { buttonStyles } from '@/components/ui/Button';

export function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="That link may be out of date, or the page may have moved."
      action={
        <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
          Back to home
        </Link>
      }
      className="my-12"
    />
  );
}
