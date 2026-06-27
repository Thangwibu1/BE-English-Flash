import mongoose, { Schema, Document } from 'mongoose';

export interface TopicDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  parentTopicId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const TopicSchema = new Schema<TopicDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    parentTopicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

TopicSchema.index({ deletedAt: 1 });

export const TopicModel = mongoose.model<TopicDocument>('Topic', TopicSchema);
