import { UserRepository } from '../../../../app/ports/repositories/UserRepository';
import { User } from '../../../../core/entities/User';
import { UserModel, UserDocument } from '../models/UserModel';
import { mapUserDocToEntity } from '../mappers/userMapper';

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findOne({ _id: id, deletedAt: null });
    return doc ? mapUserDocToEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email, deletedAt: null });
    return doc ? mapUserDocToEntity(doc) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const doc = await UserModel.findOne({ username, deletedAt: null });
    return doc ? mapUserDocToEntity(doc) : null;
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const doc = await UserModel.findOne({
      $or: [{ email: identifier }, { username: identifier }],
      deletedAt: null,
    });
    return doc ? mapUserDocToEntity(doc) : null;
  }

  async findWithPasswordHashByEmailOrUsername(
    identifier: string
  ): Promise<{ user: User; passwordHash: string } | null> {
    const doc = await UserModel.findOne({
      $or: [{ email: identifier }, { username: identifier }],
      deletedAt: null,
    });
    if (!doc) return null;
    return {
      user: mapUserDocToEntity(doc),
      passwordHash: doc.passwordHash,
    };
  }

  async create(user: Partial<User> & { passwordHash: string }): Promise<User> {
    const doc = await UserModel.create({
      email: user.email,
      username: user.username,
      passwordHash: user.passwordHash,
      displayName: user.displayName || user.username,
      role: user.role || 'user',
      status: user.status || 'active',
      deletedAt: null,
    });
    return mapUserDocToEntity(doc);
  }

  async update(id: string, user: Partial<User>): Promise<User | null> {
    const updateData: any = { ...user };
    delete updateData.id;
    delete updateData._id;

    const doc = await UserModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updateData },
      { new: true }
    );
    return doc ? mapUserDocToEntity(doc) : null;
  }
}
