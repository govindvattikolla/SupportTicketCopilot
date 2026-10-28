import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditActorType = 'customer' | 'user' | 'system';

export interface IAuditEvent extends Document {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  actor: {
    type: AuditActorType;
    userId?: Types.ObjectId;
    name: string;
  };
  action: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: false,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    actor: {
      type: {
        type: String,
        enum: ['customer', 'user', 'system'],
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
    action: {
      type: String,
      required: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditEventSchema.index({ ticketId: 1, createdAt: 1 });
AuditEventSchema.index({ workspaceId: 1, createdAt: -1 });

export const AuditEvent = mongoose.model<IAuditEvent>('AuditEvent', AuditEventSchema);
