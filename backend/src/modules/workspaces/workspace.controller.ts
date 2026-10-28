import { Request, Response } from 'express';
import { z } from 'zod';
import { Workspace } from './workspace.model';
import { AuditEvent } from '../audit/audit.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../shared/errors/AppError';

const updateWorkspaceSettingsSchema = z.object({
  name: z.string().min(1, 'Workspace name cannot be empty').max(100).optional(),
  defaultPriority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  allowCustomerReopen: z.boolean().optional(),
});

export const getCurrentWorkspace = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');

  const workspace = await Workspace.findById(req.workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');

  return sendSuccess(res, workspace, 'Workspace details retrieved');
};

export const updateWorkspaceSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');

  const parsed = updateWorkspaceSettingsSchema.parse(req.body);
  const workspace = await Workspace.findById(req.workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const previousSettings = {
    name: workspace.name,
    defaultPriority: workspace.settings.defaultPriority,
    allowCustomerReopen: workspace.settings.allowCustomerReopen,
  };

  if (parsed.name !== undefined) {
    workspace.name = parsed.name.trim();
  }

  if (parsed.defaultPriority !== undefined) {
    workspace.settings.defaultPriority = parsed.defaultPriority;
  }

  if (parsed.allowCustomerReopen !== undefined) {
    workspace.settings.allowCustomerReopen = parsed.allowCustomerReopen;
  }

  await workspace.save();

  // Log audit event for workspace settings change
  await AuditEvent.create({
    ticketId: workspace._id, // References workspace id for workspace-level audits
    workspaceId: workspace._id,
    actor: {
      type: 'user',
      userId: req.user._id,
      name: req.user.name,
    },
    action: 'workspace_settings_updated',
    details: {
      from: previousSettings,
      to: {
        name: workspace.name,
        defaultPriority: workspace.settings.defaultPriority,
        allowCustomerReopen: workspace.settings.allowCustomerReopen,
      },
    },
  });

  return sendSuccess(res, workspace, 'Workspace settings updated successfully');
};
