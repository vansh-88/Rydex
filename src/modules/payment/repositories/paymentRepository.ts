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
