import { UserRepository } from '../../ports/repositories/UserRepository';
import { PasswordAuthProvider } from '../../ports/services/PasswordAuthProvider';
import { AppError } from '../../../core/errors/AppError';

interface ForgotPasswordInput {
  identifier: string;
  newPassword: string;
  confirmPassword: string;
}

export class ForgotPasswordUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordAuthProvider: PasswordAuthProvider
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const { identifier, newPassword, confirmPassword } = input;

    if (!identifier) {
      throw new AppError('VALIDATION_ERROR', 'Email or username is required', 400);
    }

    if (!newPassword || newPassword.length < 8) {
      throw new AppError('VALIDATION_ERROR', 'New password must be at least 8 characters long', 400);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError('VALIDATION_ERROR', 'Passwords do not match', 400);
    }

    // Find user
    const user = await this.userRepository.findByEmailOrUsername(identifier);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'No user found with the email or username provided', 404);
    }

    // Hash and update password
    const passwordHash = await this.passwordAuthProvider.hash(newPassword);
    await this.userRepository.updatePasswordHash(user.id, passwordHash);
  }
}
