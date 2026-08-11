import { toSignedDocumentUrl } from '../../../infrastructure/cloudinary/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userDocumentRepository from '../../user/repositories/userDocumentRepository.js';
import * as userRepository from '../../user/repositories/userRepository.js';

export interface PendingDriverApplication {
  userId: string;
  name: string;
  email: string;
  phone: string;
  submittedAt: Date;
  licenseDocumentUrl: string | null;
}

export async function listPendingDriverApplications(): Promise<PendingDriverApplication[]> {
  const users = await userRepository.findPendingDriverApplications();

  return Promise.all(
    users.map(async (user) => {
      const document = await userDocumentRepository.findLatestDrivingLicense(user.id);
      const licenseDocumentUrl =
        document === null
          ? null
          : toSignedDocumentUrl(document.cloudinaryPublicId, document.secureUrl);

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        submittedAt: user.updatedAt,
        licenseDocumentUrl,
      };
    }),
  );
}

async function assertUserExists(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
}

export async function verifyDriverApplication(adminId: string, userId: string): Promise<void> {
  await assertUserExists(userId);

  const applied = await userRepository.verifyDriverApplication(userId, adminId);
  if (!applied) {
    throw new AppError(
      409,
      'DRIVER_APPLICATION_NOT_PENDING',
      'This driver application is not pending review',
    );
  }
}

export async function rejectDriverApplication(
  adminId: string,
  userId: string,
  rejectionReason: string,
): Promise<void> {
  await assertUserExists(userId);

  const applied = await userRepository.rejectDriverApplication(userId, adminId, rejectionReason);
  if (!applied) {
    throw new AppError(
      409,
      'DRIVER_APPLICATION_NOT_PENDING',
      'This driver application is not pending review',
    );
  }
}
