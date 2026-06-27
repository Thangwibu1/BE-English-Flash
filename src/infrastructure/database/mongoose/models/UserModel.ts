import mongoose, { Schema, Document } from 'mongoose';

export interface UserDocument extends Document {
  googleId?: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'user' | 'contributor' | 'admin';
  status: 'active' | 'disabled';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const UserSchema = new Schema<UserDocument>(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String },
    avatarUrl: { type: String },
    role: { type: String, enum: ['user', 'contributor', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ deletedAt: 1 });

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);
