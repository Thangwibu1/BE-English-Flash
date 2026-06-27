import { UserRepository } from '../../ports/repositories/UserRepository';
import { AppError } from '../../../core/errors/AppError';
import { User } from '../../../core/entities/User';

interface GetCurrentUserInput {
  userId: string;
}

export class GetCurrentUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'User not found or deleted', 401);
    }

    if (user.status === 'disabled') {
      throw new AppError('FORBIDDEN', 'User account is disabled', 403);
    }

    return user;
  }
}
