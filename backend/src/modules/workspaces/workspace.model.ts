import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWorkspace extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ticketCounter: number;
  settings: {
    defaultPriority: 'P1' | 'P2' | 'P3' | 'P4';
    allowCustomerReopen: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
      maxlength: [100, 'Workspace name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Workspace slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ticketCounter: {
      type: Number,
      default: 1000,
    },
    settings: {
      defaultPriority: {
        type: String,
        enum: ['P1', 'P2', 'P3', 'P4'],
        default: 'P3',
      },
      allowCustomerReopen: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Workspace = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
