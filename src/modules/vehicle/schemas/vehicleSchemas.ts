import { z } from 'zod';

// Mirrors prisma/schema.prisma's VehicleType/VehicleDocumentType enums —
// keep in sync if those change.
const vehicleTypeSchema = z.enum(['HATCHBACK', 'SEDAN', 'SUV', 'MUV']);
const vehicleDocumentTypeSchema = z.enum(['RC', 'INSURANCE', 'POLLUTION']);

// Normalizes "KA 01 AB 1234" and "ka01ab1234" to the same value so the
// registration_number uniqueness constraint can't be bypassed by whitespace
// or casing alone.
const registrationNumberSchema = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9 -]+$/, 'registrationNumber may only contain letters, digits, spaces, hyphens')
  .transform((value) => value.toUpperCase().replace(/[\s-]+/g, ''));

export const createVehicleSchema = z.object({
  registrationNumber: registrationNumberSchema,
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  variant: z.string().trim().min(1).max(50).optional(),
  color: z.string().trim().min(1).max(30).optional(),
  seatCapacity: z.number().int().min(1).max(20),
  vehicleType: vehicleTypeSchema,
  isAc: z.boolean().default(false),
  isAcWorking: z.boolean().optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

// registrationNumber is intentionally not editable here — changing it would
// invalidate any verification already granted against the original document.
export const updateVehicleSchema = z
  .object({
    make: z.string().trim().min(1).max(50).optional(),
    model: z.string().trim().min(1).max(50).optional(),
    variant: z.string().trim().min(1).max(50).nullable().optional(),
    color: z.string().trim().min(1).max(30).nullable().optional(),
    seatCapacity: z.number().int().min(1).max(20).optional(),
    vehicleType: vehicleTypeSchema.optional(),
    isAc: z.boolean().optional(),
    isAcWorking: z.boolean().nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const uploadVehicleDocumentSchema = z.object({
  documentType: vehicleDocumentTypeSchema,
});
export type UploadVehicleDocumentInput = z.infer<typeof uploadVehicleDocumentSchema>;
