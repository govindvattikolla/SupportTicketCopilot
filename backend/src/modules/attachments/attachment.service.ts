import crypto from 'crypto';
import path from 'path';
import { Types } from 'mongoose';
import { Attachment, IAttachment } from './attachment.model';
import { findTicketByTokenOrNumber } from '../tickets/ticket.service';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../shared/errors/AppError';

// Allowed MIME types for customer and staff uploads
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'text/csv',
  'application/zip',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.js',
  '.vbs',
  '.scr',
  '.jar',
  '.com',
  '.pif',
  '.msi',
]);

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Sanitize filename to prevent directory traversal and header injection
 */
export const sanitizeFilename = (filename: string): string => {
  // Strip path separators and null bytes
  const basename = path.basename(filename).replace(/[\0\r\n]/g, '');
  // Replace dangerous characters with underscores
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean || 'attachment.dat';
};

/**
 * Validate attachment upload against security policies
 */
export const validateAttachmentUpload = (
  filename: string,
  mimeType: string,
  sizeBytes: number
): { sanitizedFilename: string } => {
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestError(`File size exceeds 10MB limit (size: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`);
  }

  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new BadRequestError(`Forbidden file type: Executable files (${ext}) are not permitted`);
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new BadRequestError(`Unsupported MIME type (${mimeType}). Supported types: images, PDFs, plain text, CSV, ZIP, JSON.`);
  }

  const sanitized = sanitizeFilename(filename);
  return { sanitizedFilename: sanitized };
};

export interface CreateAttachmentDTO {
  workspaceId: Types.ObjectId;
  ticketId: Types.ObjectId;
  messageId?: Types.ObjectId;
  isInternal?: boolean;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: {
    type: 'customer' | 'agent' | 'lead' | 'admin';
    userId?: Types.ObjectId;
    name: string;
  };
}

export const createAttachmentRecord = async (
  dto: CreateAttachmentDTO
): Promise<IAttachment> => {
  const { sanitizedFilename } = validateAttachmentUpload(
    dto.filename,
    dto.mimeType,
    dto.sizeBytes
  );

  const storageKey = `${dto.workspaceId}/${dto.ticketId}/${crypto.randomBytes(16).toString('hex')}-${sanitizedFilename}`;

  const attachment = await Attachment.create({
    workspaceId: dto.workspaceId,
    ticketId: dto.ticketId,
    messageId: dto.messageId,
    isInternal: Boolean(dto.isInternal),
    originalFilename: dto.filename,
    sanitizedFilename,
    storageKey,
    mimeType: dto.mimeType.toLowerCase(),
    sizeBytes: dto.sizeBytes,
    uploadedBy: dto.uploadedBy,
  });

  return attachment;
};

/**
 * Secure public customer attachment access:
 * Requires valid tracking token or ticket number matching the ticket.
 * STRICT SECURITY: Internal attachments are unconditionally forbidden from public view.
 */
export const getPublicAttachmentRecord = async (
  tokenOrNumber: string,
  attachmentId: string
): Promise<IAttachment> => {
  if (!Types.ObjectId.isValid(attachmentId)) {
    throw new BadRequestError('Invalid attachment identifier format');
  }

  const ticket = await findTicketByTokenOrNumber(tokenOrNumber);
  if (!ticket) {
    throw new NotFoundError('Invalid tracking reference or ticket does not exist');
  }

  const attachment = await Attachment.findOne({
    _id: attachmentId,
    ticketId: ticket._id,
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found for this ticket');
  }

  // Security Rule: Internal staff notes and attachments cannot be accessed by public
  if (attachment.isInternal) {
    throw new ForbiddenError('Access denied: Internal staff attachments cannot be accessed via public customer tracking');
  }

  return attachment;
};

/**
 * Secure staff attachment access:
 * Requires authenticated staff member whose workspace matches the attachment's workspaceId.
 */
export const getStaffAttachmentRecord = async (
  workspaceId: Types.ObjectId,
  attachmentId: string
): Promise<IAttachment> => {
  if (!Types.ObjectId.isValid(attachmentId)) {
    throw new BadRequestError('Invalid attachment identifier format');
  }

  const attachment = await Attachment.findOne({
    _id: attachmentId,
    workspaceId,
  });

  if (!attachment) {
    throw new NotFoundError('Attachment not found in this workspace');
  }

  return attachment;
};
