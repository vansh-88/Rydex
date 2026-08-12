import { StubPaymentProvider } from './stubPaymentProvider.js';
import type { PaymentProvider } from './paymentProvider.js';

// Mirrors the map-provider factory (infrastructure/maps/index.ts): once
// Phase 10 adds RazorpayProvider, this branches on configured
// PAYMENT_PROVIDER_KEY/SECRET the same way infrastructure/resend/index.ts
// already does for Resend vs. its console fallback.
function createPaymentProvider(): PaymentProvider {
  console.warn(
    'Using StubPaymentProvider — no real payment gateway is configured yet. ' +
      'Posting-commission orders are not real charges. See claude.md §37/Phase 10.',
  );
  return new StubPaymentProvider();
}

export const paymentProvider: PaymentProvider = createPaymentProvider();

export type {
  CreateOrderInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerification,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
} from './paymentProvider.js';
