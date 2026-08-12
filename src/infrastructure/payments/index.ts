import { env } from '../../config/env.js';
import { RazorpayProvider } from './razorpayProvider.js';
import { StubPaymentProvider } from './stubPaymentProvider.js';
import type { PaymentProvider } from './paymentProvider.js';

// Mirrors infrastructure/resend/index.ts's real-provider-vs-console-fallback
// pattern exactly: configured key/secret -> real Razorpay, otherwise a stub
// that never talks to a real gateway. Local dev/testing works either way.
function createPaymentProvider(): { provider: PaymentProvider; name: string } {
  if (
    env.PAYMENT_PROVIDER_KEY !== undefined &&
    env.PAYMENT_PROVIDER_KEY.length > 0 &&
    env.PAYMENT_PROVIDER_SECRET !== undefined &&
    env.PAYMENT_PROVIDER_SECRET.length > 0
  ) {
    return {
      provider: new RazorpayProvider(env.PAYMENT_PROVIDER_KEY, env.PAYMENT_PROVIDER_SECRET, env.PAYMENT_PROVIDER_WEBHOOK_SECRET),
      name: 'razorpay',
    };
  }

  console.warn(
    'PAYMENT_PROVIDER_KEY/SECRET not set — using StubPaymentProvider. ' +
      'No real payment gateway calls will be made. See claude.md §37/Phase 10.',
  );
  return { provider: new StubPaymentProvider(env.PAYMENT_PROVIDER_WEBHOOK_SECRET), name: 'stub' };
}

const created = createPaymentProvider();
export const paymentProvider: PaymentProvider = created.provider;
// claude.md §38: the `provider` column value stamped on every Payment/
// Transaction row — paymentRecordService uses this rather than each call
// site guessing which concrete provider is active.
export const paymentProviderName: string = created.name;

export type {
  CreateOrderInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerification,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
} from './paymentProvider.js';
