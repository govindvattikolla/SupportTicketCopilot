import { Request, Response } from 'express';
import { z } from 'zod';
import { Workspace } from './workspace.model';
import { AuditEvent } from '../audit/audit.model';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../shared/errors/AppError';
import { DEFAULT_SLA_SETTINGS } from '../sla/slaEngine';

const updateWorkspaceSettingsSchema = z.object({
  name: z.string().min(1, 'Workspace name cannot be empty').max(100).optional(),
  defaultPriority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  allowCustomerReopen: z.boolean().optional(),
});

const slaPriorityConfigSchema = z.object({
  firstResponseMinutes: z.number().min(5).max(43200),
  resolutionMinutes: z.number().min(10).max(86400),
});

const updateSLASettingsSchema = z.object({
  enabled: z.boolean().optional(),
  warningThresholdPercent: z.number().min(10).max(99).optional(),
  businessHours: z
    .object({
      enabled: z.boolean().optional(),
      timeZone: z.string().min(1).optional(),
      operatingHours: z
        .object({
          start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid start time format (HH:MM)'),
          end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid end time format (HH:MM)'),
        })
        .optional(),
      workingDays: z.array(z.number().min(0).max(6)).optional(),
      holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Holidays must be YYYY-MM-DD')).optional(),
    })
    .optional(),
  priorities: z
    .object({
      P1: slaPriorityConfigSchema.optional(),
      P2: slaPriorityConfigSchema.optional(),
      P3: slaPriorityConfigSchema.optional(),
      P4: slaPriorityConfigSchema.optional(),
    })
    .optional(),
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
    ticketId: workspace._id,
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

export const getWorkspaceSLASettings = async (req: Request, res: Response): Promise<Response> => {
  if (!req.workspaceId) throw new UnauthorizedError('Workspace context required');

  const workspace = await Workspace.findById(req.workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const slaSettings = workspace.settings?.slaSettings || DEFAULT_SLA_SETTINGS;

  return sendSuccess(res, slaSettings, 'Workspace SLA settings retrieved');
};

export const updateWorkspaceSLASettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.workspaceId || !req.user) throw new UnauthorizedError('Workspace context required');

  const parsed = updateSLASettingsSchema.parse(req.body);
  const workspace = await Workspace.findById(req.workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const currentSLA = workspace.settings.slaSettings || JSON.parse(JSON.stringify(DEFAULT_SLA_SETTINGS));

  if (parsed.enabled !== undefined) currentSLA.enabled = parsed.enabled;
  if (parsed.warningThresholdPercent !== undefined) {
    currentSLA.warningThresholdPercent = parsed.warningThresholdPercent;
  }

  if (parsed.businessHours) {
    if (parsed.businessHours.enabled !== undefined) {
      currentSLA.businessHours.enabled = parsed.businessHours.enabled;
    }
    if (parsed.businessHours.timeZone !== undefined) {
      currentSLA.businessHours.timeZone = parsed.businessHours.timeZone;
    }
    if (parsed.businessHours.operatingHours !== undefined) {
      currentSLA.businessHours.operatingHours = parsed.businessHours.operatingHours;
    }
    if (parsed.businessHours.workingDays !== undefined) {
      currentSLA.businessHours.workingDays = parsed.businessHours.workingDays;
    }
    if (parsed.businessHours.holidays !== undefined) {
      currentSLA.businessHours.holidays = parsed.businessHours.holidays;
    }
  }

  if (parsed.priorities) {
    if (parsed.priorities.P1) currentSLA.priorities.P1 = parsed.priorities.P1;
    if (parsed.priorities.P2) currentSLA.priorities.P2 = parsed.priorities.P2;
    if (parsed.priorities.P3) currentSLA.priorities.P3 = parsed.priorities.P3;
    if (parsed.priorities.P4) currentSLA.priorities.P4 = parsed.priorities.P4;
  }

  workspace.settings.slaSettings = currentSLA;
  workspace.markModified('settings.slaSettings');
  await workspace.save();

  await AuditEvent.create({
    ticketId: workspace._id,
    workspaceId: workspace._id,
    actor: {
      type: 'user',
      userId: req.user._id,
      name: req.user.name,
    },
    action: 'workspace_sla_settings_updated',
    details: {
      slaSettings: currentSLA,
    },
  });

  return sendSuccess(res, currentSLA, 'SLA policy & business hours updated successfully');
};
