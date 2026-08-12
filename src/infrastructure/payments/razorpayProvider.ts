import { createHmac, timingSafeEqual } from 'node:crypto';

import Razorpay from 'razorpay';

import { AppError } from '../../shared/errors/AppError.js';
import type {
  CreateOrderInput,
  PaymentOrder,
  PaymentProvider,
  PaymentVerification,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
} from './paymentProvider.js';

// Razorpay amounts are integer subunits (paise) — ₹19 is 1900. Our domain
// works in whole rupees throughout (fareService, commissionService, §85),
// so the conversion happens only at this boundary.
const SUBUNITS_PER_RUPEE = 100;

function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Constant-time comparison — a naive `===` on signatures is a timing side
// channel (claude.md §68 "secure token handling" extends to this).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export class RazorpayProvider implements PaymentProvider {
  private readonly client: Razorpay;

  constructor(
    keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    let order;
    try {
      order = await this.client.orders.create({
        amount: Math.round(input.amount * SUBUNITS_PER_RUPEE),
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
      });
    } catch {
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Failed to create payment order');
    }

    return { providerOrderId: order.id, amount: input.amount, currency: input.currency };
  }

  // claude.md §68: Razorpay's checkout signature formula (documented,
  // vendor-specific) — order_id + "|" + payment_id, HMAC-SHA256 with the API
  // key secret. Not currently called by any webhook-driven flow (§40: the
  // webhook is the source of truth, not a frontend-reported checkout
  // success), but implemented for real since it's part of the interface
  // contract rather than left throwing on an otherwise-real provider.
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification> {
    const expected = hmacSha256Hex(`${input.providerOrderId}|${input.providerPaymentId}`, this.keySecret);
    return Promise.resolve({ verified: safeEqual(expected, input.signature) });
  }

  refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('RazorpayProvider.refund is not implemented yet — refunds land in Phase 11');
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = hmacSha256Hex(rawBody.toString('utf8'), this.webhookSecret);
    return safeEqual(expected, signature);
  }
}
