import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  tokenHash: string;
  family: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdByIp?: string;
  userAgent?: string;
  replacedByTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    family: {
      type: String,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdByIp: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    replacedByTokenHash: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index: automatically purge expired tokens when expiresAt timestamp is reached
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
