import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'lead' | 'agent';

export interface IUser extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  skills?: string[];
  maxCapacity?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return passwordHash by default
    },
    role: {
      type: String,
      enum: ['admin', 'lead', 'agent'],
      default: 'agent',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    maxCapacity: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee email uniqueness within a workspace
UserSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
