export interface CreateOrderInput {
  amount: number;
  currency: string;
  // Caller-supplied reference (e.g. a ride id) so the order can be traced
  // back to the domain entity that requested it.
  receipt: string;
}

export interface PaymentOrder {
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface PaymentVerification {
  verified: boolean;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: number;
}

export interface RefundResult {
  providerRefundId: string;
  amount: number;
}

// claude.md §37: the domain must not depend directly on a payment vendor
// SDK/API. Implementations: StubPaymentProvider (local dev, no real
// gateway) and RazorpayProvider (Phase 10).
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification>;
  refund(input: RefundInput): Promise<RefundResult>;
  // claude.md §40: webhook signature verification is provider-specific
  // (different vendors sign differently) but is exactly the kind of raw
  // vendor-crypto detail §37 says the domain (here, the webhook controller)
  // must not touch directly — so it lives behind the interface too, not as
  // a Razorpay-specific import in the webhook module. `rawBody` must be the
  // exact bytes the provider signed, not a re-serialized JSON string.
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
