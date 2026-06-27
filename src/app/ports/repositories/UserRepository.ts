import { User } from '../../../core/entities/User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmailOrUsername(identifier: string): Promise<User | null>;
  findWithPasswordHashByEmailOrUsername(identifier: string): Promise<{ user: User; passwordHash: string } | null>;
  create(user: Partial<User> & { passwordHash: string }): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User | null>;
}
