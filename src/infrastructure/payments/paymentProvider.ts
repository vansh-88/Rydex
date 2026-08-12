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
// SDK/API. No concrete implementation exists yet — see StubPaymentProvider;
// Phase 10 adds a real RazorpayProvider behind this same interface.
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification>;
  refund(input: RefundInput): Promise<RefundResult>;
}
