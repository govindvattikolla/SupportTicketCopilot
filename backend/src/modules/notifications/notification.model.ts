import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'ticket_reply'
  | 'status_changed'
  | 'sla_warning'
  | 'sla_breached';

export interface INotification extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: Types.ObjectId;
  ticketNumber?: string;
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ticket_assigned',
        'ticket_reassigned',
        'ticket_reply',
        'status_changed',
        'sla_warning',
        'sla_breached',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      index: true,
    },
    ticketNumber: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ workspaceId: 1, userId: 1, isRead: 1 });
NotificationSchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
