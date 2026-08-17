import type { PaymentOrder } from '@/api/types';

// Minimal surface of Razorpay's Checkout widget — only what we actually pass.
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  // Deliberately NOT used to confirm anything. The backend treats its webhook
  // as the only authority on payment state, so this callback is a signal to
  // start polling, never proof of success.
  handler?: () => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loader: Promise<void> | null = null;

// Loaded on demand rather than in index.html: most sessions never reach a
// payment, and a third-party script on every page load is a cost (and a
// tracking surface) those sessions should not pay.
function loadCheckout(): Promise<void> {
  if (window.Razorpay !== undefined) return Promise.resolve();

  loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      // Reset so a later attempt can retry rather than being stuck on a
      // permanently rejected promise.
      loader = null;
      reject(new Error('Could not load the payment provider'));
    };
    document.head.appendChild(script);
  });

  return loader;
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;

// Distinguishes "this app is misconfigured" from "this payment failed". The
// two need completely different messages: one is for whoever is running the
// app, the other for the user holding the card.
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigError';
  }
}

// A placeholder is as broken as an empty value, and .env.example ships one.
function isUsableKey(key: string | undefined): key is string {
  return key !== undefined && key.length > 0 && !key.includes('xxxx');
}

// The backend falls back to StubPaymentProvider whenever PAYMENT_PROVIDER_KEY
// is blank, and its order ids carry this prefix. Razorpay Checkout cannot open
// such an order, so the UI needs to recognise it rather than fail obscurely.
export function isStubOrder(order: PaymentOrder): boolean {
  return order.providerOrderId.startsWith('stub_');
}

export interface OpenCheckoutInput {
  order: PaymentOrder;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

export type CheckoutOutcome = 'completed' | 'dismissed';

// Resolves when the widget closes, either way. "completed" only means the
// user finished the widget's flow — whether money actually moved is decided
// by the webhook, and the caller must poll to find out.
export async function openCheckout(input: OpenCheckoutInput): Promise<CheckoutOutcome> {
  if (!isUsableKey(RAZORPAY_KEY_ID)) {
    throw new PaymentConfigError(
      'VITE_RAZORPAY_KEY_ID is not set in the frontend environment, so the payment window cannot open.',
    );
  }

  await loadCheckout();

  const Razorpay = window.Razorpay;
  if (Razorpay === undefined) throw new Error('Could not load the payment provider');

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const checkout = new Razorpay({
      key: RAZORPAY_KEY_ID,
      order_id: input.order.providerOrderId,
      // Razorpay works in paise; the order amount from our backend is in
      // whole rupees.
      amount: input.order.amount * 100,
      currency: input.order.currency,
      name: 'Rydex',
      description: input.description,
      prefill: input.prefill,
      theme: { color: '#0f766e' },
      handler: () => {
        settle('completed');
      },
      modal: {
        ondismiss: () => {
          settle('dismissed');
        },
      },
    });

    checkout.open();
  });
}
