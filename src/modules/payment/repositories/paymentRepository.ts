import type { Prisma } from '../../../generated/prisma/client.js';
import type { PaymentStatus } from '../../../generated/prisma/enums.js';

export interface CreatePaymentInput {
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  provider: string;
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toPaymentRecord(row: {
  id: string;
  userId: string;
  bookingId: string | null;
  rideId: string | null;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return { ...row, amount: row.amount.toNumber() };
}

// claude.md §38: gateway-level payment attempt. Created once, right after
// PaymentProvider.createOrder() succeeds (see paymentRecordService, which
// creates this alongside its Transaction row).
export async function create(db: Prisma.TransactionClient, input: CreatePaymentInput): Promise<PaymentRecord> {
  const payment = await db.payment.create({ data: input });
  return toPaymentRecord(payment);
}

export async function findByProviderOrderId(
  db: Prisma.TransactionClient,
  providerOrderId: string,
): Promise<PaymentRecord | null> {
  const payment = await db.payment.findUnique({ where: { providerOrderId } });
  return payment ? toPaymentRecord(payment) : null;
}

// claude.md §40: "webhook processing itself must be idempotent" — this only
// ever transitions from CREATED, so a duplicate webhook delivery finds
// status already SUCCESS/FAILED and the update affects 0 rows.
export async function resolve(
  db: Prisma.TransactionClient,
  id: string,
  status: Extract<PaymentStatus, 'SUCCESS' | 'FAILED'>,
  providerPaymentId: string,
): Promise<boolean> {
  const result = await db.payment.updateMany({
    where: { id, status: 'CREATED' },
    data: { status, providerPaymentId },
  });
  return result.count === 1;
}

// claude.md §31/§59 (Phase 11): refund processing needs the original
// captured payment's `providerPaymentId` to refund against — Razorpay (and
// the interface, §37) refunds a payment, not an order. `bookingId`/`rideId`
// is unambiguous at refund time: a driver-cancellation refund only ever
// fires while the ride hasn't reached COMPLETED (§19 CANCELLABLE_FROM), so
// at most one SUCCESS payment exists per booking (BOOKING_PREPAYMENT) or
// per ride (DRIVER_RIDE_FEE) at that point — `orderBy` + first-match is just
// defensive.
export async function findSuccessfulByBookingId(
  db: Prisma.TransactionClient,
  bookingId: string,
): Promise<PaymentRecord | null> {
  const payment = await db.payment.findFirst({
    where: { bookingId, status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
  });
  return payment ? toPaymentRecord(payment) : null;
}

export async function findSuccessfulByRideId(db: Prisma.TransactionClient, rideId: string): Promise<PaymentRecord | null> {
  const payment = await db.payment.findFirst({
    where: { rideId, bookingId: null, status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
  });
  return payment ? toPaymentRecord(payment) : null;
}
