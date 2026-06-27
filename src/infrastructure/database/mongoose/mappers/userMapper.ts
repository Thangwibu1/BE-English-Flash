import { User } from '../../../../core/entities/User';
import { UserDocument } from '../models/UserModel';

export function mapUserDocToEntity(doc: UserDocument): User {
  return {
    id: doc._id.toString(),
    googleId: doc.googleId,
    email: doc.email,
    username: doc.username,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    status: doc.status,
    lastLoginAt: doc.lastLoginAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
  };
}
