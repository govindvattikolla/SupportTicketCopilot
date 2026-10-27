import mongoose, { Document, Schema, Types } from 'mongoose';

export type MessageType = 'reply' | 'internal_note';
export type SenderType = 'customer' | 'agent' | 'system';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: MessageType; // 'reply' is public to customer; 'internal_note' is private to staff
  sender: {
    type: SenderType;
    userId?: Types.ObjectId;
    name: string;
    email?: string;
  };
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['reply', 'internal_note'],
      required: true,
      default: 'reply',
      index: true,
    },
    sender: {
      type: {
        type: String,
        enum: ['customer', 'agent', 'system'],
        required: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: 10000,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ ticketId: 1, createdAt: 1 });
MessageSchema.index({ workspaceId: 1, type: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
