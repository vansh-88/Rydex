import { randomUUID } from 'node:crypto';

import type {
  CreateOrderInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerification,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
} from './paymentProvider.js';

// claude.md §6/§87: Phase 6 stood up MapProvider/FareStrategy but explicitly
// deferred PaymentProvider ("do not implement payment behavior fully yet").
// This stub exists so Phase 7 (ride creation) has something real to call and
// persist an order reference against — it never talks to an actual payment
// gateway. Phase 10 replaces this with RazorpayProvider behind the same
// interface; nothing above this layer (Ride module) needs to change.
export class StubPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    await Promise.resolve();
    return {
      providerOrderId: `stub_order_${randomUUID()}`,
      amount: input.amount,
      currency: input.currency,
    };
  }

  verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerification> {
    throw new Error('StubPaymentProvider.verifyPayment is not implemented — payment confirmation lands in Phase 10');
  }

  refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('StubPaymentProvider.refund is not implemented — refunds land in Phase 11');
  }
}
