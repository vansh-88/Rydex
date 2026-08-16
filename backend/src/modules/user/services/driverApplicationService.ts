import { documentProvider } from '../../../infrastructure/cloudinary/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as userRepository from '../repositories/userRepository.js';

export interface SubmitDriverApplicationInput {
  buffer: Buffer;
}

export interface DriverApplicationResult {
  driverLicenseStatus: string;
}

export async function submitDriverApplication(
  userId: string,
  input: SubmitDriverApplicationInput,
): Promise<DriverApplicationResult> {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.role === 'DRIVER') {
    throw new AppError(409, 'ALREADY_DRIVER', 'This account is already a driver');
  }

  if (user.driverLicenseStatus === 'PENDING') {
    throw new AppError(
      409,
      'DRIVER_APPLICATION_PENDING',
      'A driver application is already pending review',
    );
  }

  const uploaded = await documentProvider.uploadDocument({
    buffer: input.buffer,
    folder: `driver-licenses/${userId}`,
  });

  const updated = await userRepository.submitDriverApplication(userId, {
    cloudinaryPublicId: uploaded.publicId,
    secureUrl: uploaded.secureUrl,
  });

  return { driverLicenseStatus: updated.driverLicenseStatus };
}
