import { UserRepository } from '../../ports/repositories/UserRepository';
import { PasswordAuthProvider } from '../../ports/services/PasswordAuthProvider';
import { AuthTokenService } from '../../ports/services/AuthTokenService';
import { AppError } from '../../../core/errors/AppError';
import { User } from '../../../core/entities/User';

interface LoginInput {
  identifier: string; // username or email
  password: string;
}

interface LoginOutput {
  user: User;
  accessToken: string;
}

export class LoginUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordAuthProvider: PasswordAuthProvider,
    private authTokenService: AuthTokenService
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const { identifier, password } = input;

    // Fetch user and password hash
    const authData = await this.userRepository.findWithPasswordHashByEmailOrUsername(identifier);
    if (!authData) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username/email or password', 401);
    }

    const { user, passwordHash } = authData;

    // Check account status
    if (user.status === 'disabled') {
      throw new AppError('FORBIDDEN', 'Your account is disabled', 403);
    }

    // Compare passwords
    const isPasswordValid = await this.passwordAuthProvider.compare(password, passwordHash);
    if (!isPasswordValid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username/email or password', 401);
    }

    // Update last login timestamp
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();

    // Sign token
    const accessToken = this.authTokenService.sign({
      id: user.id,
      role: user.role,
    });

    return {
      user,
      accessToken,
    };
  }
}
