import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttachment extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  ticketId: Types.ObjectId;
  messageId?: Types.ObjectId;
  isInternal: boolean; // If true, strictly restricted to staff; public customer access blocked
  originalFilename: string;
  sanitizedFilename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: {
    type: 'customer' | 'agent' | 'lead' | 'admin';
    userId?: Types.ObjectId;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      index: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    sanitizedFilename: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      max: 10 * 1024 * 1024, // 10MB maximum file size
    },
    uploadedBy: {
      type: {
        type: String,
        enum: ['customer', 'agent', 'lead', 'admin'],
        required: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      name: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for tenant-scoped ticket attachment lookups
AttachmentSchema.index({ workspaceId: 1, ticketId: 1 });

export const Attachment = mongoose.model<IAttachment>('Attachment', AttachmentSchema);
