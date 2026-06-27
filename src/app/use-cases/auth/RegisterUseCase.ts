import { UserRepository } from '../../ports/repositories/UserRepository';
import { PasswordAuthProvider } from '../../ports/services/PasswordAuthProvider';
import { AuthTokenService } from '../../ports/services/AuthTokenService';
import { AppError } from '../../../core/errors/AppError';
import { User } from '../../../core/entities/User';

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

interface RegisterOutput {
  user: User;
  accessToken: string;
}

export class RegisterUseCase {
  constructor(
    private userRepository: UserRepository,
    private passwordAuthProvider: PasswordAuthProvider,
    private authTokenService: AuthTokenService
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const { username, email, password } = input;

    // Check if email already exists
    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new AppError('DUPLICATE_RESOURCE', 'Email is already registered', 409);
    }

    // Check if username already exists
    const existingUsername = await this.userRepository.findByUsername(username);
    if (existingUsername) {
      throw new AppError('DUPLICATE_RESOURCE', 'Username is already taken', 409);
    }

    // Hash password
    const passwordHash = await this.passwordAuthProvider.hash(password);

    // Create user
    const createdUser = await this.userRepository.create({
      username,
      email,
      passwordHash,
      role: 'user',
      status: 'active',
    });

    // Sign token
    const accessToken = this.authTokenService.sign({
      id: createdUser.id,
      role: createdUser.role,
    });

    return {
      user: createdUser,
      accessToken,
    };
  }
}
