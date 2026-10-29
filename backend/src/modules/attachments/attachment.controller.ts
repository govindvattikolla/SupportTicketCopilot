import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  createAttachmentRecord,
  getPublicAttachmentRecord,
  getStaffAttachmentRecord,
} from './attachment.service';
import { findTicketByTokenOrNumber } from '../tickets/ticket.service';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/AppError';

const uploadAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive(),
  isInternal: z.boolean().optional(),
  messageId: z.string().optional(),
});

export const downloadPublicAttachment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { token, attachmentId } = req.params;
  const attachment = await getPublicAttachmentRecord(token, attachmentId);

  // Set secure HTTP download headers to prevent browser execution and MIME confusion
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(attachment.sanitizedFilename)}"`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  // Return attachment details / file content descriptor
  res.status(200).json({
    success: true,
    data: {
      attachmentId: attachment._id,
      ticketId: attachment.ticketId,
      filename: attachment.sanitizedFilename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
    },
  });
};

export const downloadStaffAttachment = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');
  const { attachmentId } = req.params;

  const attachment = await getStaffAttachmentRecord(
    req.workspaceId,
    attachmentId
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(attachment.sanitizedFilename)}"`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  res.status(200).json({
    success: true,
    data: {
      attachmentId: attachment._id,
      workspaceId: attachment.workspaceId,
      ticketId: attachment.ticketId,
      filename: attachment.sanitizedFilename,
      isInternal: attachment.isInternal,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
    },
  });
};

export const uploadStaffAttachment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');
  const { id } = req.params;
  const body = uploadAttachmentSchema.parse(req.body);

  const ticket = await findTicketByTokenOrNumber(id);
  if (!ticket || ticket.workspaceId.toString() !== req.workspaceId.toString()) {
    throw new NotFoundError('Ticket not found in this workspace');
  }

  const attachment = await createAttachmentRecord({
    workspaceId: req.workspaceId,
    ticketId: ticket._id,
    messageId: body.messageId ? new Types.ObjectId(body.messageId) : undefined,
    isInternal: body.isInternal,
    filename: body.filename,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes,
    uploadedBy: {
      type: req.user.role as any,
      userId: req.user._id,
      name: req.user.name,
    },
  });

  return sendSuccess(res, attachment, 'Attachment registered successfully', 201);
};

export const uploadPublicAttachment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { token } = req.params;
  const body = uploadAttachmentSchema.parse(req.body);

  const ticket = await findTicketByTokenOrNumber(token);
  if (!ticket) {
    throw new NotFoundError('Invalid tracking reference or ticket does not exist');
  }

  const attachment = await createAttachmentRecord({
    workspaceId: ticket.workspaceId,
    ticketId: ticket._id,
    isInternal: false, // Customer uploads are never internal
    filename: body.filename,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes,
    uploadedBy: {
      type: 'customer',
      name: ticket.customer.name,
    },
  });

  return sendSuccess(res, attachment, 'Customer attachment uploaded successfully', 201);
};
