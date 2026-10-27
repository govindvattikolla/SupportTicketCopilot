import mongoose, { Document, Schema, Types } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketCategory = 'technical' | 'billing' | 'general' | 'feature_request' | 'bug';

export interface ITicket extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  ticketNumber: string;
  trackingToken: string;
  customer: {
    name: string;
    email: string;
  };
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: Types.ObjectId;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    ticketNumber: {
      type: String,
      required: true,
      trim: true,
    },
    trackingToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: 100,
      },
      email: {
        type: String,
        required: [true, 'Customer email is required'],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid customer email address'],
      },
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: ['technical', 'billing', 'general', 'feature_request', 'bug'],
      default: 'general',
      index: true,
    },
    priority: {
      type: String,
      enum: ['P1', 'P2', 'P3', 'P4'],
      default: 'P3',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    firstResponseAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal tenant-scoped queries
TicketSchema.index({ workspaceId: 1, ticketNumber: 1 }, { unique: true });
TicketSchema.index({ workspaceId: 1, status: 1 });
TicketSchema.index({ workspaceId: 1, priority: 1 });
TicketSchema.index({ workspaceId: 1, assignedTo: 1 });
TicketSchema.index({ workspaceId: 1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
