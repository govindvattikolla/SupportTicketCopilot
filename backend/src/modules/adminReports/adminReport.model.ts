import mongoose, { Document, Schema, Types } from 'mongoose';

export type AdminReportCategory =
  | 'incident_escalation'
  | 'staffing_capacity'
  | 'policy_compliance'
  | 'sla_bottleneck'
  | 'tooling_request'
  | 'general_update';

export type AdminReportPriority = 'low' | 'medium' | 'high' | 'critical';

export type AdminReportStatus =
  | 'submitted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface IAdminReportMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  senderRole: 'lead' | 'admin';
  message: string;
  createdAt: Date;
}

export interface IAdminReport extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  leadId: Types.ObjectId;
  leadName: string;
  title: string;
  category: AdminReportCategory;
  priority: AdminReportPriority;
  status: AdminReportStatus;
  summary: string;
  actionRequired?: string;
  ticketId?: Types.ObjectId;
  ticketNumber?: string;
  messages: IAdminReportMessage[];
  adminDirective?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdminReportMessageSchema = new Schema<IAdminReportMessage>(
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
      enum: ['lead', 'admin'],
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

const AdminReportSchema = new Schema<IAdminReport>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leadName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: [
        'incident_escalation',
        'staffing_capacity',
        'policy_compliance',
        'sla_bottleneck',
        'tooling_request',
        'general_update',
      ],
      default: 'incident_escalation',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'high',
      index: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed'],
      default: 'submitted',
      index: true,
    },
    summary: {
      type: String,
      required: [true, 'Summary is required'],
      trim: true,
      maxlength: 3000,
    },
    actionRequired: {
      type: String,
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
    messages: [AdminReportMessageSchema],
    adminDirective: {
      type: String,
      trim: true,
      maxlength: 2000,
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

AdminReportSchema.index({ workspaceId: 1, leadId: 1 });
AdminReportSchema.index({ workspaceId: 1, status: 1, priority: 1 });
AdminReportSchema.index({ workspaceId: 1, createdAt: -1 });

export const AdminReport = mongoose.model<IAdminReport>('AdminReport', AdminReportSchema);
