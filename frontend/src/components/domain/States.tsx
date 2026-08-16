import { AlertTriangle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  // Empty states in this app are usually the result of a real constraint —
  // search matches within 10 km on a single calendar day — so the body should
  // explain the rule, not just say "nothing here".
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-border-strong px-6 py-12 text-center',
        className,
      )}
    >
      {Icon !== undefined && <Icon className="mb-3 size-8 text-ink-faint" aria-hidden />}
      <p className="font-medium text-ink">{title}</p>
      {description !== undefined && (
        <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

// Note this is also what a permission failure looks like: the backend returns
// 404 for anything the caller does not own, so "we could not find that ride"
// is shown both when a ride is genuinely gone and when it belongs to somebody
// else. The copy in lib/errorCopy.ts is written to read correctly either way.
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-card border border-red-200 bg-red-50/50 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="mb-3 size-8 text-red-600" aria-hidden />
      <p className="font-medium text-ink">{message}</p>
      {onRetry !== undefined && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
      {requestId !== undefined && (
        // Surfaced quietly so a user reporting a problem can quote it — the
        // backend logs the same id against the failing request.
        <p className="mt-4 font-mono text-xs text-ink-faint">{requestId}</p>
      )}
    </div>
  );
}

// Inline variant for errors inside a card or form, where a full panel would
// push the actual content off screen.
export function InlineError({ error, className }: { error: unknown; className?: string }) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

  return (
    <p role="alert" className={cn('flex items-start gap-2 text-sm text-red-700', className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
