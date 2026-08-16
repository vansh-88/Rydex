import { Prisma } from '../../generated/prisma/client.js';

interface DriverAdapterErrorCause {
  constraint?: { fields?: string[] };
}

interface DriverAdapterErrorLike {
  cause?: DriverAdapterErrorCause;
}

// Prisma 7's pg driver adapter reports the violated column(s) at
// err.meta.driverAdapterError.cause.constraint.fields, not the flat
// err.meta.target string array older Prisma versions/adapters used. Support
// both shapes so this keeps working across driver-adapter versions.
export function getUniqueConstraintFields(err: unknown): string[] {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return [];
  }

  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === 'string');
  }

  const driverAdapterError = err.meta?.driverAdapterError as DriverAdapterErrorLike | undefined;
  const fields = driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(fields) ? fields : [];
}
