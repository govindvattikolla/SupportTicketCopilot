import mongoose, { Document, Schema, Types } from 'mongoose';

export type TicketQueryCategory =
  | 'technical'
  | 'refund_approval'
  | 'policy_guidance'
  | 'sla_escalation'
  | 'customer_dispute'
  | 'other';

export type TicketQueryUrgency = 'low' | 'medium' | 'high' | 'urgent';

export type TicketQueryStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export interface ITicketQueryMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  senderRole: 'agent' | 'lead' | 'admin';
  message: string;
  createdAt: Date;
}

export interface ITicketQuery extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  ticketId: Types.ObjectId;
  ticketNumber: string;
  agentId: Types.ObjectId;
  agentName: string;
  leadId?: Types.ObjectId;
  leadName?: string;
  subject: string;
  category: TicketQueryCategory;
  urgency: TicketQueryUrgency;
  status: TicketQueryStatus;
  messages: ITicketQueryMessage[];
  resolutionSummary?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TicketQueryMessageSchema = new Schema<ITicketQueryMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['agent', 'lead', 'admin'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const TicketQuerySchema = new Schema<ITicketQuery>(
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
    ticketNumber: {
      type: String,
      required: true,
      trim: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    agentName: {
      type: String,
      required: true,
      trim: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    leadName: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: [
        'technical',
        'refund_approval',
        'policy_guidance',
        'sla_escalation',
        'customer_dispute',
        'other',
      ],
      default: 'technical',
      index: true,
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    messages: [TicketQueryMessageSchema],
    resolutionSummary: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

TicketQuerySchema.index({ workspaceId: 1, ticketId: 1 });
TicketQuerySchema.index({ workspaceId: 1, agentId: 1, status: 1 });
TicketQuerySchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

export const TicketQuery = mongoose.model<ITicketQuery>('TicketQuery', TicketQuerySchema);
