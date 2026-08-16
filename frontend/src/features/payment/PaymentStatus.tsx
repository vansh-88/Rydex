import { AlertTriangle, CheckCircle2, Clock, Loader2, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

import type { PaymentPhase } from './usePaymentFlow';

interface PaymentStatusProps {
  phase: PaymentPhase;
  error: unknown;
  isStub: boolean;
  onRetry: () => void;
  // What the user gets when this settles — "Your seat is confirmed",
  // "Your ride is live".
  successTitle: string;
  successBody?: string;
  successAction?: ReactNode;
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  const TONES = {
    info: 'border-border-subtle bg-canvas',
    success: 'border-emerald-200 bg-emerald-50/60',
    warning: 'border-amber-200 bg-amber-50/60',
    danger: 'border-red-200 bg-red-50/60',
  };

  return (
    <div className={cn('rounded-card border p-5 text-center', TONES[tone])} aria-live="polite">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      {children !== undefined && <div className="mt-2 text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

export function PaymentStatus({
  phase,
  error,
  isStub,
  onRetry,
  successTitle,
  successBody,
  successAction,
}: PaymentStatusProps) {
  switch (phase) {
    case 'creating':
      return (
        <Panel
          tone="info"
          icon={<Loader2 className="size-6 animate-spin text-accent-700" aria-hidden />}
          title="Setting up your payment…"
        />
      );

    case 'awaiting-checkout':
      return (
        <Panel
          tone="info"
          icon={<Loader2 className="size-6 animate-spin text-accent-700" aria-hidden />}
          title="Complete the payment in the window"
        >
          If you don&rsquo;t see it, check that your browser hasn&rsquo;t blocked a pop-up.
        </Panel>
      );

    case 'confirming':
      return (
        <Panel
          tone="info"
          icon={<Loader2 className="size-6 animate-spin text-accent-700" aria-hidden />}
          title="Confirming your payment…"
        >
          {/* Deliberately not an optimistic success. The backend accepts a
              payment only when the provider's signed webhook arrives, so
              until the server says so, nothing is confirmed. */}
          <p>This usually takes a few seconds. Please don&rsquo;t close this page.</p>
          {isStub && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
              <Terminal className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>Development mode.</strong> The backend is using the stub payment provider,
                so no real checkout opens and no webhook will arrive on its own. Fire the webhook
                manually, or set <code>PAYMENT_PROVIDER_KEY</code> and run a tunnel.
              </span>
            </div>
          )}
        </Panel>
      );

    case 'succeeded':
      return (
        <Panel
          tone="success"
          icon={<CheckCircle2 className="size-6 text-emerald-600" aria-hidden />}
          title={successTitle}
        >
          {successBody !== undefined && <p>{successBody}</p>}
          {successAction !== undefined && <div className="mt-4">{successAction}</div>}
        </Panel>
      );

    case 'timed-out':
      return (
        <Panel
          tone="warning"
          icon={<Clock className="size-6 text-amber-600" aria-hidden />}
          title="Still confirming your payment"
        >
          <p>
            Your bank is taking longer than usual. We&rsquo;ll notify you as soon as it clears —
            it&rsquo;s safe to close this page, and you can check the status under My trips.
          </p>
        </Panel>
      );

    case 'dismissed':
      return (
        <Panel
          tone="warning"
          icon={<AlertTriangle className="size-6 text-amber-600" aria-hidden />}
          title="Payment not completed"
        >
          <p>You closed the payment window. Your seat is still held — you can try again.</p>
          <Button onClick={onRetry} className="mt-4">
            Try again
          </Button>
        </Panel>
      );

    case 'failed':
      return (
        <Panel
          tone="danger"
          icon={<AlertTriangle className="size-6 text-red-600" aria-hidden />}
          title={error instanceof ApiError ? error.message : 'Payment could not be completed'}
        >
          <Button variant="secondary" onClick={onRetry} className="mt-2">
            Try again
          </Button>
        </Panel>
      );

    case 'idle':
    default:
      return null;
  }
}
