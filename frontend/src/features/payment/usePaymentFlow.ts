import { useCallback, useRef, useState } from 'react';

import { invalidate } from '@/api/store';
import type { PaymentOrder } from '@/api/types';

import { isStubOrder, openCheckout } from './razorpay';

// Rydex takes money at three moments — publishing a ride, reserving a seat,
// and settling the remaining 90% after the trip. All three follow the same
// shape, and all three share the same hard constraint:
//
//   the backend never trusts a client-reported checkout result.
//
// Payment state changes only when Razorpay's signed webhook reaches the
// server (backend docs/claude.md §40). So "the widget closed" tells us
// nothing; the only honest way to learn the outcome is to ask the server
// until it changes its mind. That polling window is a real, designed state —
// not a spinner papering over an assumed success.
export type PaymentPhase =
  | 'idle'
  | 'creating'
  | 'awaiting-checkout'
  | 'confirming'
  | 'succeeded'
  | 'failed'
  // The webhook has not landed within the polling window. Not an error: the
  // payment may well succeed a moment later, so the user is told it is still
  // being confirmed rather than that it failed.
  | 'timed-out'
  // The user closed the widget without paying. The reservation still stands
  // until its hold expires, so this is recoverable by simply trying again.
  | 'dismissed';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 45_000;

export interface PaymentFlowConfig<T> {
  // Creates the order server-side. Must be idempotent for a given user
  // intent — callers pass a stable Idempotency-Key.
  createOrder: () => Promise<{ order: PaymentOrder; entityId: string; entity: T }>;
  // Re-reads the entity whose status the webhook will change.
  pollEntity: (entityId: string, signal: AbortSignal) => Promise<T>;
  // True once the webhook has been processed and the entity has moved on.
  isSettled: (entity: T) => boolean;
  // True if the payment definitively failed (e.g. BookingStatus
  // PAYMENT_FAILED), so the UI can stop polling early.
  isFailed?: (entity: T) => boolean;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  // Cache prefixes to refresh once the payment settles.
  invalidates?: string[];
}

export interface PaymentFlowState<T> {
  phase: PaymentPhase;
  entity: T | undefined;
  error: unknown;
  // True when the backend is running StubPaymentProvider, which has no
  // checkout widget to open.
  isStub: boolean;
  start: () => void;
  reset: () => void;
}

export function usePaymentFlow<T>(config: PaymentFlowConfig<T>): PaymentFlowState<T> {
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [entity, setEntity] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isStub, setIsStub] = useState(false);

  const configRef = useRef(config);
  configRef.current = config;
  const abortRef = useRef<AbortController | null>(null);

  // Polls until the entity settles, fails, or the window closes.
  const pollUntilSettled = useCallback(async (entityId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (controller.signal.aborted) return;

      try {
        const current = await configRef.current.pollEntity(entityId, controller.signal);
        if (controller.signal.aborted) return;
        setEntity(current);

        if (configRef.current.isSettled(current)) {
          setPhase('succeeded');
          const prefixes = configRef.current.invalidates;
          if (prefixes !== undefined && prefixes.length > 0) invalidate(...prefixes);
          return;
        }

        if (configRef.current.isFailed?.(current) === true) {
          setPhase('failed');
          return;
        }
      } catch {
        // A single failed poll is not a failed payment — the webhook is
        // still in flight and the next tick may well succeed. Keep going
        // until the deadline rather than reporting a false failure.
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!controller.signal.aborted) setPhase('timed-out');
  }, []);

  const start = useCallback(() => {
    void (async () => {
      setError(undefined);
      setPhase('creating');

      let created;
      try {
        created = await configRef.current.createOrder();
      } catch (caught) {
        setError(caught);
        setPhase('failed');
        return;
      }

      setEntity(created.entity);

      // With the stub provider there is no widget and no webhook will ever
      // arrive on its own, so opening checkout would hang forever. Surface
      // the state instead and let the developer drive the transition.
      if (isStubOrder(created.order)) {
        setIsStub(true);
        setPhase('confirming');
        void pollUntilSettled(created.entityId);
        return;
      }

      setPhase('awaiting-checkout');

      let outcome;
      try {
        outcome = await openCheckout({
          order: created.order,
          description: configRef.current.description,
          prefill: configRef.current.prefill,
        });
      } catch (caught) {
        setError(caught);
        setPhase('failed');
        return;
      }

      if (outcome === 'dismissed') {
        // The order and the seat reservation both still exist; the user can
        // pay from the same screen until the hold expires.
        setPhase('dismissed');
        return;
      }

      setPhase('confirming');
      await pollUntilSettled(created.entityId);
    })();
  }, [pollUntilSettled]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setError(undefined);
  }, []);

  return { phase, entity, error, isStub, start, reset };
}
