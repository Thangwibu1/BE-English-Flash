import mongoose, { Schema, Document } from 'mongoose';

export interface ContributionSubmissionDocument extends Document {
  submittedBy: mongoose.Types.ObjectId;
  type: 'vocabulary' | 'reading';
  action: 'create' | 'update';
  targetId?: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  payloadJson: string;
  adminNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const ContributionSubmissionSchema = new Schema<ContributionSubmissionDocument>(
  {
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['vocabulary', 'reading'], required: true },
    action: { type: String, enum: ['create', 'update'], required: true },
    targetId: { type: Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_changes'],
      default: 'pending',
    },
    payloadJson: { type: String, required: true },
    adminNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

ContributionSubmissionSchema.index({ submittedBy: 1 });
ContributionSubmissionSchema.index({ status: 1 });
ContributionSubmissionSchema.index({ type: 1 });
ContributionSubmissionSchema.index({ deletedAt: 1 });

export const ContributionSubmissionModel = mongoose.model<ContributionSubmissionDocument>(
  'ContributionSubmission',
  ContributionSubmissionSchema
);
