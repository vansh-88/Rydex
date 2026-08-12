import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  CreateOrderInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerification,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
} from './paymentProvider.js';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// claude.md §6/§87: Phase 6 stood up MapProvider/FareStrategy but explicitly
// deferred PaymentProvider ("do not implement payment behavior fully yet").
// This stub exists so Phase 7 (ride creation) has something real to call and
// persist an order reference against — it never talks to an actual payment
// gateway. Phase 10 adds RazorpayProvider behind the same interface for
// production use; this stays as the local-dev fallback when no
// PAYMENT_PROVIDER_KEY/SECRET is configured (infrastructure/payments/index.ts).
export class StubPaymentProvider implements PaymentProvider {
  constructor(private readonly webhookSecret: string) {}

  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    await Promise.resolve();
    return {
      providerOrderId: `stub_order_${randomUUID()}`,
      amount: input.amount,
      currency: input.currency,
    };
  }

  verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerification> {
    throw new Error('StubPaymentProvider.verifyPayment is not implemented — no real checkout flow exists to call it');
  }

  refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('StubPaymentProvider.refund is not implemented — refunds land in Phase 11');
  }

  // Real HMAC-SHA256 verification against PAYMENT_PROVIDER_WEBHOOK_SECRET —
  // same scheme RazorpayProvider uses — so local webhook testing without a
  // real Razorpay account still exercises genuine signature verification,
  // not a trivial always-true stub.
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }
}
